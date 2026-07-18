import { describe, test, expect } from 'bun:test';

// Test the regex patterns directly by extracting them and testing against various patterns
const importPattern = /(?:import|export)\s+[^'"]*?from\s+['"](\..?\/[^'"]+)['"]/g;
const requirePattern = /require\(\s*['"`](\..?\/[^'"]+)['"`]\s*\)/g;
const dynamicImportPattern = /import\(\s*['"](\..?\/[^'"]+)['"]\s*\)/g;

function extractImports(code: string): string[] {
  const results: string[] = [];
  for (const match of code.matchAll(importPattern)) {
    if (match[1]) results.push(match[1]);
  }
  for (const match of code.matchAll(requirePattern)) {
    if (match[1]) results.push(match[1]);
  }
  for (const match of code.matchAll(dynamicImportPattern)) {
    if (match[1]) results.push(match[1]);
  }
  return results;
}

describe('Import regex patterns', () => {
  test('should detect standard imports', () => {
    const code = `import { foo } from './bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect dynamic imports', () => {
    const code = `import('./bar')`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect dynamic imports with double quotes', () => {
    const code = `import("./bar")`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect type-only imports', () => {
    const code = `import type { X } from './bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect re-exports', () => {
    const code = `export { foo } from './bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect re-exports with star', () => {
    const code = `export * from './bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect template literals in require', () => {
    const code = 'require(`./bar`)';
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect require with single quotes', () => {
    const code = `require('./bar')`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect require with double quotes', () => {
    const code = `require("./bar")`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect parent directory imports', () => {
    const code = `import { foo } from '../bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('../bar');
  });

  test('should detect dynamic import with parent directory', () => {
    const code = `import('../bar')`;
    const imports = extractImports(code);
    expect(imports).toContain('../bar');
  });

  test('should detect default exports', () => {
    const code = `export { default } from './bar'`;
    const imports = extractImports(code);
    expect(imports).toContain('./bar');
  });

  test('should detect all patterns in a real-world file', () => {
    const code = `
import { foo } from './foo';
import type { Bar } from './types';
import('./dynamic');
export { baz } from './baz';
export * from './star';
require('./required');
require(\`./template\`);
`;
    const imports = extractImports(code);
    expect(imports).toContain('./foo');
    expect(imports).toContain('./types');
    expect(imports).toContain('./dynamic');
    expect(imports).toContain('./baz');
    expect(imports).toContain('./star');
    expect(imports).toContain('./required');
    expect(imports).toContain('./template');
    expect(imports.length).toBe(7);
  });

  test('should not match non-relative imports', () => {
    const code = `
import { foo } from 'lodash';
import('express');
require('fs');
`;
    const imports = extractImports(code);
    expect(imports.length).toBe(0);
  });

  test('should not match URL imports', () => {
    const code = `
import { foo } from 'https://example.com/mod.ts';
import('https://example.com/mod.ts');
`;
    const imports = extractImports(code);
    expect(imports.length).toBe(0);
  });
});
