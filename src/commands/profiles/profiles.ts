import type { LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  getMatchedInstructionProfiles,
  type InstructionProfile,
} from '../../utils/instructionProfiles.js'

function formatProfile(profile: InstructionProfile): string {
  const condition = profile.condition ? ` (condition: ${profile.condition})` : ''
  return `  • ${profile.name}${condition}\n    ${profile.content.split('\n')[0]?.slice(0, 80) ?? ''}`
}

export async function call(
  _args: string,
  _context: ToolUseContext,
): Promise<LocalCommandResult> {
  const profiles = getMatchedInstructionProfiles()

  if (profiles.length === 0) {
    return {
      type: 'text',
      value:
        'No instruction profiles are active.\n\n' +
        'Configure profiles in settings.json under "instructionProfiles":\n' +
        '  [\n' +
        '    { "name": "Backend", "content": "...", "condition": "**/src/**" }\n' +
        '  ]\n' +
        'Profiles without a "condition" always apply; with one, they apply ' +
        'only when the current directory matches the glob.',
    }
  }

  const lines = profiles.map(formatProfile)
  return {
    type: 'text',
    value: `Active instruction profiles (${profiles.length}):\n\n${lines.join('\n')}`,
  }
}
