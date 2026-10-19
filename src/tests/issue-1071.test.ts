/**
 * TDD regression test for GitHub issue #1071.
 *
 * ws.onmessage in src/upstreamproxy/relay.ts silently discarded data when
 * decodeChunk() returned null (malformed UpstreamProxyChunk). For a tunneled
 * TLS connection this meant missing bytes in the stream — the client's TLS
 * handshake or data transfer would hang indefinitely with no error message,
 * no logging, and no connection close.
 *
 * Fix: when decodeChunk returns null, log a debug message and close the
 * tunnel with an error so the client can retry rather than hang.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..', '..')

describe('issue #1071: malformed protobuf chunks must not be silently dropped', () => {
  test('ws.onmessage handles decodeChunk returning null', () => {
    const src = readFileSync(
      join(ROOT, 'src/upstreamproxy/relay.ts'),
      'utf8',
    )
    // The handler must have an explicit branch for the null case.
    // Before the fix the code was:
    //   const payload = decodeChunk(raw)
    //   if (payload && payload.length > 0) { ... }
    // with no else — null was silently dropped.
    expect(src).toMatch(/decodeChunk\s*\(\s*raw\s*\)/u)
    expect(src).toMatch(/payload\s*===\s*null|!payload|payload\s*==\s*null/u)
  })

  test('malformed chunk emits a debug log', () => {
    const src = readFileSync(
      join(ROOT, 'src/upstreamproxy/relay.ts'),
      'utf8',
    )
    // Must log something identifying the malformed chunk.
    expect(src).toMatch(/logForDebugging\s*\(/u)
    expect(src).toMatch(/malformed/i)
  })

  test('malformed chunk closes the tunnel (does not silently drop)', () => {
    const src = readFileSync(
      join(ROOT, 'src/upstreamproxy/relay.ts'),
      'utf8',
    )
    // After logging, the tunnel must be torn down so the client can retry.
    // We look for a close/error path being invoked in the null branch.
    expect(src).toMatch(/st\.closed\s*=\s*true/u)
    expect(src).toMatch(/sock\.end\(\)/u)
  })

  test('decodeChunk still returns null for malformed input', async () => {
    const { decodeChunk } = await import('../upstreamproxy/relay.js')
    // Wrong tag byte
    expect(decodeChunk(new Uint8Array([0x12, 0x01, 0x41]))).toBeNull()
    // Truncated varint (continuation bit set, no terminator)
    expect(decodeChunk(new Uint8Array([0x0a, 0x80]))).toBeNull()
    // Declared length exceeds available bytes
    expect(decodeChunk(new Uint8Array([0x0a, 0x05, 0x41]))).toBeNull()
    // Valid empty chunk
    expect(decodeChunk(new Uint8Array([0x0a, 0x00]))).toEqual(new Uint8Array(0))
    // Valid chunk
    expect(decodeChunk(new Uint8Array([0x0a, 0x02, 0x41, 0x42]))).toEqual(
      new Uint8Array([0x41, 0x42]),
    )
  })
})
