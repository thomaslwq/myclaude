import { describe, it, expect } from 'bun:test';
import { extractRelativeImports } from '../dev-entry';

describe('extractRelativeImports', () => {
  it('should extract require() imports', () => {
    const code = `const x = require('./utils/helper');`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract import() dynamic imports', () => {
    const code = `const x = await import('./utils/helper');`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract import/export from statements', () => {
    const code = `import { foo } from './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should NOT extract require() inside a string literal', () => {
    const code = `const msg = "use require('./utils/helper')";`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract import() inside a string literal', () => {
    const code = `const msg = "use import('./utils/helper')";`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract require() inside a template literal', () => {
    const code = 'const msg = `use require(\'./utils/helper\')`;';
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract import() inside a template literal', () => {
    const code = 'const msg = `use import(\'./utils/helper\')`;';
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract require() inside a single-line comment', () => {
    const code = `// this is a require('./utils/helper') call`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract import() inside a single-line comment', () => {
    const code = `// this is an import('./utils/helper') call`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract require() inside a multi-line comment', () => {
    const code = `/*
 * this is a require('./utils/helper') call
 */`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should NOT extract import() inside a multi-line comment', () => {
    const code = `/*
 * this is an import('./utils/helper') call
 */`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should handle mixed content with real and fake imports', () => {
    const code = [
      `import { real } from './real/module';`,
      `const a = "fake require('./fake/module')";`,
      `const b = 'fake import("./other/fake")';`,
      `const c = require('./real/helper');`,
      `// const d = require('./commented/out');`,
      `const e = await import('./real/dynamic');`,
    ].join('\n');
    expect(extractRelativeImports(code)).toEqual([
      './real/module',
      './real/helper',
      './real/dynamic',
    ]);
  });

  it('should handle string literal with escaped quotes', () => {
    const code = `const msg = "escaped \\"require('./utils/helper')\"";`;
    expect(extractRelativeImports(code)).toEqual([]);
  });

  it('should extract relative import with escaped quote in specifier', () => {
    const code = String.raw`import { foo } from './foo\'bar';`;
    expect(extractRelativeImports(code)).toEqual(["./foo\\'bar"]);
  });

  it('should extract relative import with escaped quote in specifier (double quote)', () => {
    const code = String.raw`import { foo } from "./foo\"bar";`;
    expect(extractRelativeImports(code)).toEqual(['./foo\\"bar']);
  });

  it('should extract relative import with escaped quote in specifier (require)', () => {
    const code = String.raw`const x = require('./foo\'bar');`;
    expect(extractRelativeImports(code)).toEqual(["./foo\\'bar"]);
  });

  it('should extract relative import with escaped quote in specifier (dynamic import)', () => {
    const code = String.raw`const x = await import('./foo\'bar');`;
    expect(extractRelativeImports(code)).toEqual(["./foo\\'bar"]);
  });

  it('should extract specifier when comment appears after from', () => {
    const code = `import { foo } from /* comment */ './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract specifier when comments appear throughout import statement', () => {
    const code = `import /* c1 */ { foo } /* c2 */ from /* c3 */ './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract side-effect import specifier', () => {
    const code = `import './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract side-effect import specifier with comment', () => {
    const code = `import /* comment */ './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should extract specifier when comment appears after export from', () => {
    const code = `export { foo } from /* comment */ './utils/helper';`;
    expect(extractRelativeImports(code)).toEqual(['./utils/helper']);
  });

  it('should not lose imports when an unterminated multi-line comment appears at end of file', () => {
    const code = `import { real } from './real/import';
/* this comment is never closed`;
    // The unterminated comment at EOF should not cause overshoot; prior imports remain
    expect(extractRelativeImports(code)).toEqual(['./real/import']);
  });
});
