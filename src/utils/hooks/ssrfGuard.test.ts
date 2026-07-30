import { describe, it, expect } from 'bun:test'
import { isBlockedAddress } from './ssrfGuard'

describe('ssrfGuard', () => {
  describe('isBlockedAddress', () => {
    // --- IPv4 ---
    it('blocks 10.0.0.0/8', () => {
      expect(isBlockedAddress('10.0.0.1')).toBe(true)
      expect(isBlockedAddress('10.255.255.255')).toBe(true)
    })

    it('blocks 169.254.0.0/16', () => {
      expect(isBlockedAddress('169.254.169.254')).toBe(true)
    })

    it('blocks 172.16.0.0/12', () => {
      expect(isBlockedAddress('172.16.0.1')).toBe(true)
      expect(isBlockedAddress('172.31.255.255')).toBe(true)
    })

    it('blocks 192.168.0.0/16', () => {
      expect(isBlockedAddress('192.168.1.1')).toBe(true)
    })

    it('blocks 100.64.0.0/10 (CGNAT)', () => {
      expect(isBlockedAddress('100.100.100.200')).toBe(true)
    })

    it('blocks 0.0.0.0/8', () => {
      expect(isBlockedAddress('0.0.0.0')).toBe(true)
    })

    it('allows 127.0.0.0/8 (loopback)', () => {
      expect(isBlockedAddress('127.0.0.1')).toBe(false)
      expect(isBlockedAddress('127.255.255.255')).toBe(false)
    })

    it('allows public IPv4', () => {
      expect(isBlockedAddress('8.8.8.8')).toBe(false)
      expect(isBlockedAddress('1.1.1.1')).toBe(false)
    })

    // --- IPv6 ---
    it('allows ::1 (loopback)', () => {
      expect(isBlockedAddress('::1')).toBe(false)
    })

    it('blocks :: (unspecified)', () => {
      expect(isBlockedAddress('::')).toBe(true)
    })

    it('blocks fc00::/7 (unique local)', () => {
      expect(isBlockedAddress('fc00::')).toBe(true)
      expect(isBlockedAddress('fd00::1')).toBe(true)
    })

    it('blocks fe80::/10 (link-local)', () => {
      expect(isBlockedAddress('fe80::1')).toBe(true)
      expect(isBlockedAddress('fe80::a:b:c:d')).toBe(true)
    })

    // --- IPv4-mapped IPv6 ---
    it('blocks ::ffff:10.0.0.1 (mapped private)', () => {
      expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true)
    })

    it('blocks ::ffff:169.254.169.254 (mapped metadata)', () => {
      expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true)
    })

    it('blocks ::ffff:192.168.1.1 (mapped private)', () => {
      expect(isBlockedAddress('::ffff:192.168.1.1')).toBe(true)
    })

    it('blocks ::ffff:a9fe:a9fe (hex-form mapped metadata)', () => {
      expect(isBlockedAddress('::ffff:a9fe:a9fe')).toBe(true)
    })

    it('allows ::ffff:8.8.8.8 (mapped public)', () => {
      expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false)
    })

    // --- IPv4-compatible IPv6 (NEW: these were previously unblocked) ---
    it('blocks ::10.0.0.1 (IPv4-compatible private)', () => {
      expect(isBlockedAddress('::10.0.0.1')).toBe(true)
    })

    it('blocks ::169.254.169.254 (IPv4-compatible metadata)', () => {
      expect(isBlockedAddress('::169.254.169.254')).toBe(true)
    })

    it('blocks ::192.168.1.1 (IPv4-compatible private)', () => {
      expect(isBlockedAddress('::192.168.1.1')).toBe(true)
    })

    it('blocks 0:0:0:0:0:0:10.0.0.1 (expanded IPv4-compatible)', () => {
      expect(isBlockedAddress('0:0:0:0:0:0:10.0.0.1')).toBe(true)
    })

    it('allows ::8.8.8.8 (IPv4-compatible public)', () => {
      expect(isBlockedAddress('::8.8.8.8')).toBe(false)
    })

    // --- 6to4 addresses (NEW) ---
    it('blocks 2002:ac10:0101:: (6to4 with 172.16.1.1)', () => {
      expect(isBlockedAddress('2002:ac10:0101::')).toBe(true)
    })

    it('blocks 2002:c0a8:0101:: (6to4 with 192.168.1.1)', () => {
      expect(isBlockedAddress('2002:c0a8:0101::')).toBe(true)
    })

    it('allows 2002:0808:0808:: (6to4 with 8.8.8.8)', () => {
      expect(isBlockedAddress('2002:0808:0808::')).toBe(false)
    })

    // --- ISATAP addresses (NEW) ---
    it('blocks fe80::5efe:10.0.0.1 (ISATAP private)', () => {
      expect(isBlockedAddress('fe80::5efe:10.0.0.1')).toBe(true)
    })

    it('blocks fe80::5efe:192.168.1.1 (ISATAP private)', () => {
      expect(isBlockedAddress('fe80::5efe:192.168.1.1')).toBe(true)
    })

    it('allows fe80::5efe:8.8.8.8 (ISATAP public)', () => {
      expect(isBlockedAddress('fe80::5efe:8.8.8.8')).toBe(false)
    })

    // --- Edge cases with compressed notation ---
    it('blocks fd00::1 (unique local compressed)', () => {
      expect(isBlockedAddress('fd00::1')).toBe(true)
    })

    it('blocks fe80::a:b:c:d (link-local compressed)', () => {
      expect(isBlockedAddress('fe80::a:b:c:d')).toBe(true)
    })

    // --- Non-IP strings ---
    it('returns false for non-IP strings', () => {
      expect(isBlockedAddress('not-an-ip')).toBe(false)
      expect(isBlockedAddress('')).toBe(false)
    })
  })
})
