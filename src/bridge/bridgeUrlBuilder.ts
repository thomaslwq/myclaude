import {
  getClaudeAiBaseUrl,
  getRemoteSessionUrl,
} from '../constants/product.js'

/**
 * Build the connect URL shown when the bridge is idle.
 * This is a pure function that only depends on environment configuration.
 */
export function buildBridgeConnectUrl(
  environmentId: string,
  ingressUrl?: string,
): string {
  const baseUrl = getClaudeAiBaseUrl(undefined, ingressUrl)
  return `${baseUrl}/code?bridge=${environmentId}`
}

/**
 * Build the session URL shown when a session is attached.
 * This is a pure function that only depends on environment configuration.
 */
export function buildBridgeSessionUrl(
  sessionId: string,
  environmentId: string,
  ingressUrl?: string,
): string {
  return `${getRemoteSessionUrl(sessionId, ingressUrl)}?bridge=${environmentId}`
}
