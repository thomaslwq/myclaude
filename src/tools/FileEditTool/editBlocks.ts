/**
 * Aider-style structured edit blocks.
 *
 * This module implements parsing of structured edit blocks that allow the AI
 * to specify exactly what code should be changed, reducing hallucinations
 * and unintended modifications.
 *
 * Format:
 *
 * <file_path>
 * <<<<EDIT
 * old_string
 * ----
 * new_string
 * >>>>EDIT
 *
 * Multiple blocks can appear in a single message, and text outside blocks is
 * ignored.
 */

export const EDIT_BLOCK_START = '<<<<EDIT'
export const EDIT_BLOCK_SEPARATOR = '----'
export const EDIT_BLOCK_END = '>>>>EDIT'

export type EditBlockEdit = {
  old_string: string
  new_string: string
}

export type EditBlock = {
  filePath: string
  edits: EditBlockEdit[]
}

/**
 * Parses a message containing Aider-style edit blocks into structured edits.
 *
 * Text outside edit blocks is ignored. Multiple edit blocks for the same
 * file are merged into a single EditBlock entry with multiple edits.
 *
 * @throws if a block is malformed (missing separator or end marker)
 */
export function parseEditBlocks(message: string): EditBlock[] {
  const lines = message.split('\n')
  const blocks: EditBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    if (line.trim() === EDIT_BLOCK_START) {
      // The file path should be the last non-empty line before the start marker.
      // Search backwards from i-1 for the file path.
      let filePathIndex = i - 1
      while (filePathIndex >= 0 && lines[filePathIndex]!.trim() === '') {
        filePathIndex--
      }

      if (filePathIndex < 0) {
        throw new Error(
          'Malformed edit block: missing file path before <<<<EDIT marker',
        )
      }

      const filePath = lines[filePathIndex]!.trim()

      // Collect old_string lines until separator
      const oldLines: string[] = []
      i++
      let foundSeparator = false
      while (i < lines.length && lines[i]!.trim() !== EDIT_BLOCK_SEPARATOR) {
        if (lines[i]!.trim() === EDIT_BLOCK_END) {
          throw new Error(
            'Malformed edit block: missing ---- separator before >>>>EDIT',
          )
        }
        oldLines.push(lines[i]!)
        i++
      }

      if (i >= lines.length) {
        throw new Error(
          'Malformed edit block: missing ---- separator and >>>>EDIT end marker',
        )
      }

      // We found the separator
      foundSeparator = true
      void foundSeparator
      i++ // skip separator

      // Collect new_string lines until end marker
      const newLines: string[] = []
      while (i < lines.length && lines[i]!.trim() !== EDIT_BLOCK_END) {
        newLines.push(lines[i]!)
        i++
      }

      if (i >= lines.length) {
        throw new Error(
          'Malformed edit block: missing >>>>EDIT end marker',
        )
      }

      i++ // skip end marker

      const old_string = oldLines.join('\n')
      const new_string = newLines.join('\n')

      // Find or create the block for this file path
      let block = blocks.find(b => b.filePath === filePath)
      if (!block) {
        block = { filePath, edits: [] }
        blocks.push(block)
      }

      block.edits.push({ old_string, new_string })
    } else {
      i++
    }
  }

  return blocks
}
