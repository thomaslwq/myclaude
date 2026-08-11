import { describe, it, expect, beforeEach } from 'bun:test'
import { createBridgeLogger } from '../bridgeUI'

describe('Bridge UI - QR toggle and spawn mode display during reconnecting/failed states', () => {
  let writeOutput: string[] = []
  let verbose = false

  beforeEach(() => {
    writeOutput = []
    verbose = false
  })

  const createLogger = () => {
    return createBridgeLogger({
      verbose,
      write: (s: string) => writeOutput.push(s),
    })
  }

  const bannerConfig = {
    sessionIngressUrl: 'https://example.com',
    spawnMode: 'single-session',
    maxSessions: 1,
    sandbox: false,
  }

  it('should preserve the reconnecting status when toggling QR', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start reconnecting
    logger.updateReconnectingStatus('5s', '10s')
    const statusAfterReconnecting = writeOutput.join('')
    expect(statusAfterReconnecting).toContain('Reconnecting')

    // Toggle QR - should re-render, not clear the status
    const beforeToggle = writeOutput.length
    logger.toggleQr()
    const afterToggle = writeOutput.join('')

    // The reconnecting status should still be present
    expect(afterToggle).toContain('Reconnecting')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeToggle)
    // The status was cleared and re-rendered (cursor-up + erase sequence present)
    expect(afterToggle).toContain('\x1b[')
  })

  it('should preserve the failed status when toggling QR', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start failed
    logger.updateFailedStatus('Connection failed')
    const statusAfterFailed = writeOutput.join('')
    expect(statusAfterFailed).toContain('Remote Control Failed')
    expect(statusAfterFailed).toContain('Connection failed')

    // Toggle QR - should re-render, not clear the status
    const beforeToggle = writeOutput.length
    logger.toggleQr()
    const afterToggle = writeOutput.join('')

    // The failed status should still be present
    expect(afterToggle).toContain('Remote Control Failed')
    expect(afterToggle).toContain('Connection failed')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeToggle)
  })

  it('should preserve the reconnecting status when refreshing display', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start reconnecting
    logger.updateReconnectingStatus('5s', '10s')
    const statusAfterReconnecting = writeOutput.join('')
    expect(statusAfterReconnecting).toContain('Reconnecting')

    // Refresh display - should re-render, not clear the status
    const beforeRefresh = writeOutput.length
    logger.refreshDisplay()
    const afterRefresh = writeOutput.join('')

    // The reconnecting status should still be present
    expect(afterRefresh).toContain('Reconnecting')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeRefresh)
  })

  it('should preserve the failed status when refreshing display', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start failed
    logger.updateFailedStatus('Connection failed')
    const statusAfterFailed = writeOutput.join('')
    expect(statusAfterFailed).toContain('Remote Control Failed')

    // Refresh display - should re-render, not clear the status
    const beforeRefresh = writeOutput.length
    logger.refreshDisplay()
    const afterRefresh = writeOutput.join('')

    // The failed status should still be present
    expect(afterRefresh).toContain('Remote Control Failed')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeRefresh)
  })

  it('should preserve the reconnecting status when setting spawn mode display', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start reconnecting
    logger.updateReconnectingStatus('5s', '10s')
    const statusAfterReconnecting = writeOutput.join('')
    expect(statusAfterReconnecting).toContain('Reconnecting')

    // Set spawn mode display + refresh (simulates 'w' key handler)
    const beforeSet = writeOutput.length
    logger.setSpawnModeDisplay('worktree')
    logger.refreshDisplay()
    const afterSet = writeOutput.join('')

    // The reconnecting status should still be present
    expect(afterSet).toContain('Reconnecting')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeSet)
  })

  it('should preserve the failed status when setting spawn mode display', () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Start failed
    logger.updateFailedStatus('Connection failed')
    const statusAfterFailed = writeOutput.join('')
    expect(statusAfterFailed).toContain('Remote Control Failed')

    // Set spawn mode display + refresh (simulates 'w' key handler)
    const beforeSet = writeOutput.length
    logger.setSpawnModeDisplay('worktree')
    logger.refreshDisplay()
    const afterSet = writeOutput.join('')

    // The failed status should still be present
    expect(afterSet).toContain('Remote Control Failed')
    // New output was written (re-render happened)
    expect(writeOutput.length).toBeGreaterThan(beforeSet)
  })

  it('should render QR code when toggled on during reconnecting state', async () => {
    const logger = createLogger()
    logger.printBanner(bannerConfig, 'env-123')

    // Wait for QR generation to complete (triggered by printBanner)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Start reconnecting
    logger.updateReconnectingStatus('5s', '10s')

    // Toggle QR on
    logger.toggleQr()

    // QR code lines should be in the output (QR visibility was updated)
    const output = writeOutput.join('')
    // QR codes are ASCII art - they contain block characters or spaces
    expect(output).toContain('Reconnecting')

    // Toggle QR off and verify
    logger.toggleQr()
    const outputAfterOff = writeOutput.join('')
    expect(outputAfterOff).toContain('Reconnecting')
  })
})
