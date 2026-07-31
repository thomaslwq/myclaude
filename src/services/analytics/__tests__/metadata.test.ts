import { describe, it, expect } from 'bun:test'
import { sanitizeToolNameForAnalytics, isToolDetailsLoggingEnabled } from '../metadata'

describe('sanitizeToolNameForAnalytics', () => {
  it('should preserve built-in tool names', () => {
    const builtInTools = [
      'Bash',
      'Read',
      'Write',
      'Edit',
      'NotebookEdit',
      'FileSystem',
      'Grep',
      'Git',
      'Diff',
      'Terminal',
      'Python',
      'Node',
      'Shell',
      'Code',
      'Skill',
    ]

    for (const tool of builtInTools) {
      const result = sanitizeToolNameForAnalytics(tool)
      expect(result).toBe(tool)
    }
  })

  it('should redact MCP tool names', () => {
    const mcpTools = [
      'mcp__filesystem__read_file',
      'mcp__github__create_issue',
      'mcp__postgres__query',
      'mcp__slack__post_message',
      'mcp__custom_tool__action',
    ]

    for (const tool of mcpTools) {
      const result = sanitizeToolNameForAnalytics(tool)
      expect(result).toBe('mcp_tool')
    }
  })

  it('should handle empty string', () => {
    const result = sanitizeToolNameForAnalytics('')
    expect(result).toBe('')
  })

  it('should handle null and undefined', () => {
    // TypeScript will catch these at compile time, but we test runtime safety
    // These should not throw, just return the value as-is
    expect(sanitizeToolNameForAnalytics(null as any)).toBeNull()
    expect(sanitizeToolNameForAnalytics(undefined as any)).toBeUndefined()
  })

  it('should handle tool names that start with mcp__ but have extra characters', () => {
    const result = sanitizeToolNameForAnalytics('mcp__extra__characters')
    expect(result).toBe('mcp_tool')
  })

  it('should handle tool names that contain mcp__ but are not at the start', () => {
    const result = sanitizeToolNameForAnalytics('my_mcp_tool')
    expect(result).toBe('my_mcp_tool')
  })

  it('should handle tool names with numbers', () => {
    const result = sanitizeToolNameForAnalytics('mcp__server1__tool2')
    expect(result).toBe('mcp_tool')
  })

  it('should handle tool names with underscores', () => {
    const result = sanitizeToolNameForAnalytics('mcp__server_name__tool_name')
    expect(result).toBe('mcp_tool')
  })

  it('should handle tool names with hyphens', () => {
    const result = sanitizeToolNameForAnalytics('mcp__server-name__tool-name')
    expect(result).toBe('mcp_tool')
  })
})

describe('isToolDetailsLoggingEnabled', () => {
  it('should return false when OTEL_LOG_TOOL_DETAILS is not set', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    delete process.env.OTEL_LOG_TOOL_DETAILS
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(false)
    
    // Restore
    if (originalEnv) {
      process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
    } else {
      delete process.env.OTEL_LOG_TOOL_DETAILS
    }
  })

  it('should return true when OTEL_LOG_TOOL_DETAILS is set to 1', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = '1'
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(true)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })

  it('should return true when OTEL_LOG_TOOL_DETAILS is set to true', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = 'true'
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(true)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })

  it('should return false when OTEL_LOG_TOOL_DETAILS is set to 0', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = '0'
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(false)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })

  it('should return false when OTEL_LOG_TOOL_DETAILS is set to false', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = 'false'
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(false)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })

  it('should return false when OTEL_LOG_TOOL_DETAILS is set to empty string', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = ''
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(false)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })

  it('should return false when OTEL_LOG_TOOL_DETAILS is set to any other value', () => {
    const originalEnv = process.env.OTEL_LOG_TOOL_DETAILS
    process.env.OTEL_LOG_TOOL_DETAILS = 'anything'
    
    const result = isToolDetailsLoggingEnabled()
    expect(result).toBe(false)
    
    // Restore
    process.env.OTEL_LOG_TOOL_DETAILS = originalEnv
  })
})
