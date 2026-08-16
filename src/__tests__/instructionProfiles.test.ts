import { describe, it, expect, beforeEach, vi } from 'bun:test'
import {
  getMatchedInstructionProfiles,
  buildInstructionProfilesPrompt,
} from '../utils/instructionProfiles'
import { getInitialSettings } from '../utils/settings/settings'
import { getCwd } from '../utils/cwd'

vi.mock('../utils/settings/settings.js', () => ({
  getInitialSettings: () => mockGetInitialSettings(),
}))
vi.mock('../utils/cwd.js', () => ({
  getCwd: () => mockGetCwd(),
}))

const mockGetInitialSettings = vi.fn()
const mockGetCwd = vi.fn()

describe('getMatchedInstructionProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInitialSettings.mockReturnValue({})
    mockGetCwd.mockReturnValue('/home/user/project/src')
  })

  it('returns empty when no profiles configured', () => {
    expect(getMatchedInstructionProfiles()).toEqual([])
  })

  it('always-applies profiles (no condition) are returned', () => {
    mockGetInitialSettings.mockReturnValue({
      instructionProfiles: [
        { name: 'Always', content: 'Always apply' },
        {
          name: 'Backend',
          content: 'Backend rules',
          condition: '**/src/**',
        },
      ],
    })
    const matched = getMatchedInstructionProfiles()
    expect(matched.map(p => p.name)).toEqual(['Always', 'Backend'])
  })

  it('filters profiles whose condition does not match cwd', () => {
    mockGetCwd.mockReturnValue('/home/user/project/backend')
    mockGetInitialSettings.mockReturnValue({
      instructionProfiles: [
        {
          name: 'Frontend',
          content: 'Frontend rules',
          condition: '**/frontend/**',
        },
        {
          name: 'Backend',
          content: 'Backend rules',
          condition: '**/backend/**',
        },
      ],
    })
    const matched = getMatchedInstructionProfiles()
    expect(matched.map(p => p.name)).toEqual(['Backend'])
  })

  it('tolerates invalid glob conditions without crashing', () => {
    mockGetInitialSettings.mockReturnValue({
      instructionProfiles: [
        { name: 'Broken', content: 'x', condition: '[' },
        { name: 'Good', content: 'y' },
      ],
    })
    const matched = getMatchedInstructionProfiles()
    expect(matched.map(p => p.name)).toEqual(['Good'])
  })
})

describe('buildInstructionProfilesPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCwd.mockReturnValue('/work')
  })

  it('returns null when no profiles match', () => {
    mockGetInitialSettings.mockReturnValue({})
    expect(buildInstructionProfilesPrompt()).toBeNull()
  })

  it('builds a prompt fragment with matched profile names', () => {
    mockGetInitialSettings.mockReturnValue({
      instructionProfiles: [
        { name: 'TDD', content: 'Write tests first.' },
      ],
    })
    const prompt = buildInstructionProfilesPrompt()
    expect(prompt).toContain('TDD')
    expect(prompt).toContain('Write tests first.')
  })
})
