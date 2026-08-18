import { describe, it, expect } from 'bun:test'
import {
  parseEditBlocks,
  type EditBlock,
  EDIT_BLOCK_START,
  EDIT_BLOCK_SEPARATOR,
  EDIT_BLOCK_END,
} from '../editBlocks.js'
import { getPatchForEdits } from '../utils.js'

describe('parseEditBlocks', () => {
  it('parses a single edit block', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 2',
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toEqual([
      {
        filePath: 'foo.ts',
        edits: [
          {
            old_string: 'const x = 1',
            new_string: 'const x = 2',
          },
        ],
      },
    ])
  })

  it('parses multiple edit blocks for the same file', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 2',
      EDIT_BLOCK_END,
      'foo.ts',
      EDIT_BLOCK_START,
      'const y = 3',
      EDIT_BLOCK_SEPARATOR,
      'const y = 4',
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.filePath).toBe('foo.ts')
    expect(result[0]!.edits).toHaveLength(2)
    expect(result[0]!.edits[0]).toEqual({
      old_string: 'const x = 1',
      new_string: 'const x = 2',
    })
    expect(result[0]!.edits[1]).toEqual({
      old_string: 'const y = 3',
      new_string: 'const y = 4',
    })
  })

  it('parses edit blocks for different files', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 2',
      EDIT_BLOCK_END,
      'bar.ts',
      EDIT_BLOCK_START,
      'const y = 3',
      EDIT_BLOCK_SEPARATOR,
      'const y = 4',
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.filePath).toBe('foo.ts')
    expect(result[1]!.filePath).toBe('bar.ts')
  })

  it('handles multi-line old and new strings', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'function foo() {',
      '  return 1',
      '}',
      EDIT_BLOCK_SEPARATOR,
      'function foo() {',
      '  return 2',
      '}',
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.edits[0]!.old_string).toBe(
      'function foo() {\n  return 1\n}',
    )
    expect(result[0]!.edits[0]!.new_string).toBe(
      'function foo() {\n  return 2\n}',
    )
  })

  it('throws on malformed block missing separator', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_END,
    ].join('\n')

    expect(() => parseEditBlocks(input)).toThrow()
  })

  it('throws on malformed block missing end marker', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 2',
    ].join('\n')

    expect(() => parseEditBlocks(input)).toThrow()
  })

  it('returns empty array when no edit blocks found', () => {
    const input = 'just some text without edit blocks'
    expect(parseEditBlocks(input)).toEqual([])
  })

  it('ignores text outside edit blocks', () => {
    const input = [
      'Here is the change:',
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 2',
      EDIT_BLOCK_END,
      'That is all.',
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.filePath).toBe('foo.ts')
  })

  it('handles empty old_string (file creation)', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      EDIT_BLOCK_SEPARATOR,
      'const x = 1',
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.edits[0]!.old_string).toBe('')
    expect(result[0]!.edits[0]!.new_string).toBe('const x = 1')
  })

  it('handles empty new_string (deletion)', () => {
    const input = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      EDIT_BLOCK_END,
    ].join('\n')

    const result = parseEditBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.edits[0]!.old_string).toBe('const x = 1')
    expect(result[0]!.edits[0]!.new_string).toBe('')
  })
})

describe('parseEditBlocks + getPatchForEdits integration', () => {
  it('applies parsed edit blocks to file content', () => {
    const fileContents = 'const x = 1\nconst y = 2\n'
    const message = [
      'foo.ts',
      EDIT_BLOCK_START,
      'const x = 1',
      EDIT_BLOCK_SEPARATOR,
      'const x = 10',
      EDIT_BLOCK_END,
      'foo.ts',
      EDIT_BLOCK_START,
      'const y = 2',
      EDIT_BLOCK_SEPARATOR,
      'const y = 20',
      EDIT_BLOCK_END,
    ].join('\n')

    const blocks = parseEditBlocks(message)
    expect(blocks).toHaveLength(1)

    const { updatedFile } = getPatchForEdits({
      filePath: 'foo.ts',
      fileContents,
      edits: blocks[0]!.edits.map(e => ({
        old_string: e.old_string,
        new_string: e.new_string,
        replace_all: false,
      })),
    })

    expect(updatedFile).toBe('const x = 10\nconst y = 20\n')
  })
})
