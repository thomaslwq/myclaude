import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  getKeybindingsPath,
} from '../../keybindings/loadUserBindings.js'
import { generateKeybindingsTemplate } from '../../keybindings/template.js'
import { getErrnoCode } from '../../utils/errors.js'
import { editFileInEditor } from '../../utils/promptEditor.js'

export async function call(): Promise<{ type: 'text'; value: string }> {
  const keybindingsPath = getKeybindingsPath()

  // Write template with 'wx' flag (exclusive create) — fails with EEXIST if
  // the file already exists. Avoids a stat pre-check (TOCTOU race + extra syscall).
  let fileExists = false
  await mkdir(dirname(keybindingsPath), { recursive: true })
  try {
    await writeFile(keybindingsPath, generateKeybindingsTemplate(), {
      encoding: 'utf-8',
      flag: 'wx',
    })
  } catch (err) {
    if (getErrnoCode(err) === 'EEXIST') {
      fileExists = true
    } else {
      throw err
    }
  }

  // Launch editor. If editing succeeds, tell the user where the file is.
  const editAccepted = await editFileInEditor(keybindingsPath)
  return {
    type: 'text',
    value: editAccepted
      ? `Keybindings file saved to ${keybindingsPath}`
      : `No changes made. Your keybindings file is at ${keybindingsPath}`,
  }
}
