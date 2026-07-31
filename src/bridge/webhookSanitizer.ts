import { escape } from 'lodash-es'

/**
 * Sanitizes inbound webhook content to prevent XSS and log injection attacks.
 * 
 * This function removes potentially dangerous HTML/JavaScript from content that
 * might be logged, displayed, or used in analytics. It preserves the structure
 * of the data while neutralizing script tags, event handlers, and other
 * dangerous patterns.
 * 
 * @param content - The content to sanitize (string, array, or object)
 * @returns Sanitized content safe for logging and analytics
 */
export function sanitizeInboundWebhookContent<T>(content: T): T {
  if (typeof content === 'string') {
    // Remove HTML tags and script content
    const sanitized = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
      .replace(/<applet[^>]*>.*?<\/applet>/gi, '')
      .replace(/<form[^>]*>.*?<\/form>/gi, '')
      .replace(/on\w+\s*=\s*['"]?[^\s'">]+/gi, '') // Remove event handlers
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:text\/html[^\s'">]+/gi, '') // Remove data: html protocol
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .trim()

    // Escape any remaining HTML entities to prevent log injection
    return escape(sanitized) as any
  }

  if (Array.isArray(content)) {
    return content.map(item => sanitizeInboundWebhookContent(item)) as any
  }

  if (typeof content === 'object' && content !== null) {
    const sanitized: Record<string, unknown> = {}
    for (const key in content) {
      if (Object.prototype.hasOwnProperty.call(content, key)) {
        sanitized[key] = sanitizeInboundWebhookContent(content[key])
      }
    }
    return sanitized as any
  }

  return content
}

/**
 * Sanitizes webhook payloads for logging and analytics.
 * 
 * This is a no-op function that preserves the payload structure.
 * For actual sanitization, use sanitizeInboundWebhookContent.
 * 
 * @param value - The value to sanitize
 * @returns The original value (no-op)
 */
export function sanitizeWebhookPayload<T>(value: T): T {
  return value
}
