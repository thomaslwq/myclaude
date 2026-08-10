import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import { applyCommandApprovalPolicy } from '../bashPermissions'

const mockGetInitialSettings = vi.fn()

vi.mock('../../../utils/settings/settings.js', () => ({
  getInitialSettings: () => mockGetInitialSettings(),
}))

const allowResult: PermissionResult = {
  behavior: 'allow',
  decisionReason: { type: 'other', reason: 'auto-allowed' },
}

const denyResult: PermissionResult = {
  behavior: 'deny',
  message: 'denied by rule',
  decisionReason: { type: 'rule', rule: 'Bash(rm:*)' },
}

const askResult: PermissionResult = {
  behavior: 'ask',
  message: 'requires approval',
  decisionReason: { type: 'other', reason: 'ask rule' },
}

describe('applyCommandApprovalPolicy', () => {
  beforeEach(() => {
    mockGetInitialSettings.mockReturnValue({})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps allow verdict when commandApproval is unset', async () => {
    const result = await applyCommandApprovalPolicy('ls -la', allowResult)
    expect(result).toBe(allowResult)
  })

  it('keeps allow verdict when commandApproval=never', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'never' })
    const result = await applyCommandApprovalPolicy('ls -la', allowResult)
    expect(result).toBe(allowResult)
  })

  it('upgrades allow to ask for safe commands when commandApproval=always', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'always' })
    const result = await applyCommandApprovalPolicy('ls -la', allowResult)
    expect(result.behavior).toBe('ask')
  })

  it('keeps allow for safe commands when commandApproval=dangerous', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'dangerous' })
    const result = await applyCommandApprovalPolicy('ls -la', allowResult)
    expect(result).toBe(allowResult)
  })

  it('upgrades allow to ask for dangerous commands when commandApproval=dangerous', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'dangerous' })
    const result = await applyCommandApprovalPolicy('rm -rf /tmp/data', allowResult)
    expect(result.behavior).toBe('ask')
  })

  it('upgrades allow to ask for sudo commands when commandApproval=dangerous', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'dangerous' })
    const result = await applyCommandApprovalPolicy('sudo systemctl stop docker', allowResult)
    expect(result.behavior).toBe('ask')
  })

  it('never downgrades deny verdicts regardless of commandApproval=always', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'always' })
    const result = await applyCommandApprovalPolicy('rm -rf /', denyResult)
    expect(result).toBe(denyResult)
  })

  it('keeps ask verdicts unchanged', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'always' })
    const result = await applyCommandApprovalPolicy('ls -la', askResult)
    expect(result).toBe(askResult)
  })

  it('preserves updatedInput when upgrading allow to ask', async () => {
    mockGetInitialSettings.mockReturnValue({ commandApproval: 'always' })
    const withInput: PermissionResult = {
      ...allowResult,
      updatedInput: { command: 'ls -la', timeout: 5000 },
    }
    const result = await applyCommandApprovalPolicy('ls -la', withInput)
    expect(result.behavior).toBe('ask')
    if (result.behavior === 'ask') {
      expect(result.updatedInput).toEqual(withInput.updatedInput)
    }
  })
})
