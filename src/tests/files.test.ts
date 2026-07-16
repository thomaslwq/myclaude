import { isBinaryContent, BINARY_EXTENSIONS } from '../constants/files.js'
import { describe, it, expect } from 'bun:test'

describe('isBinaryContent', () => {
  it('should detect null bytes as binary', () => {
    const buffer = Buffer.from('hello world\x00world')
    expect(isBinaryContent(buffer)).toBe(true)
  })

  it('should detect high proportion of non-printable characters', () => {
    // Create a buffer with 20% non-printable characters
    const buffer = Buffer.alloc(100)
    for (let i = 0; i < 20; i++) {
      buffer[i] = 0x00 // null byte
    }
    // Fill rest with printable characters
    for (let i = 20; i < 100; i++) {
      buffer[i] = 0x41 // 'A'
    }
    expect(isBinaryContent(buffer)).toBe(true)
  })

  it('should allow low proportion of non-printable characters', () => {
    // Create a buffer with 5% non-printable characters (should be text)
    const buffer = Buffer.alloc(100)
    for (let i = 0; i < 5; i++) {
      buffer[i] = 0x09 // tab
    }
    // Fill rest with printable characters
    for (let i = 5; i < 100; i++) {
      buffer[i] = 0x41 // 'A'
    }
    expect(isBinaryContent(buffer)).toBe(false)
  })

  it('should detect binary files with null bytes', () => {
    // ELF binary file with null bytes in header
    const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x00, 0x00, 0x00, 0x00])
    expect(isBinaryContent(elfBuffer)).toBe(true)
  })

  it('should handle empty buffer', () => {
    const buffer = Buffer.alloc(0)
    expect(isBinaryContent(buffer)).toBe(false)
  })

  it('should handle small buffer with null byte', () => {
    const buffer = Buffer.from('hello\x00')
    expect(isBinaryContent(buffer)).toBe(true)
  })

  it('should handle buffer smaller than BINARY_CHECK_SIZE', () => {
    const buffer = Buffer.alloc(100)
    for (let i = 0; i < 25; i++) {
      buffer[i] = 0x00 // null byte
    }
    expect(isBinaryContent(buffer)).toBe(true)
  })

  it('should detect binary content after text header (issue #102)', () => {
    // Create a buffer with 10000 bytes of text followed by binary content
    const buffer = Buffer.alloc(15000)
    // Fill first 10000 bytes with printable text
    for (let i = 0; i < 10000; i++) {
      buffer[i] = 0x41 // 'A'
    }
    // Add binary content (null byte) after the text header
    buffer[10000] = 0x00
    
    // This should detect the binary content even though it's after the first 8192 bytes
    expect(isBinaryContent(buffer)).toBe(true)
  })

  it('should detect binary content after long text header (issue #102)', () => {
    // Create a buffer with 20000 bytes of text followed by binary content
    const buffer = Buffer.alloc(25000)
    // Fill first 20000 bytes with printable text
    for (let i = 0; i < 20000; i++) {
      buffer[i] = 0x41 // 'A'
    }
    // Add binary content (null byte) after the text header
    buffer[20000] = 0x00
    
    // This should detect the binary content even though it's after the first 8192 bytes
    expect(isBinaryContent(buffer)).toBe(true)
  })
})

describe('BINARY_EXTENSIONS', () => {
  it('should contain common binary extensions', () => {
    expect(BINARY_EXTENSIONS.has('.png')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.jpg')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.exe')).toBe(true)
    expect(BINARY_EXTENSIONS.has('.pdf')).toBe(true)
  })

  it('should not contain common text extensions', () => {
    expect(BINARY_EXTENSIONS.has('.txt')).toBe(false)
    expect(BINARY_EXTENSIONS.has('.md')).toBe(false)
    expect(BINARY_EXTENSIONS.has('.json')).toBe(false)
  })
})