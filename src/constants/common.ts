import memoize from 'lodash-es/memoize.js'

// This ensures you get the LOCAL date in ISO format
/**
 * Validates that a string is a valid ISO date string in YYYY-MM-DD format.
 * Returns true if the date is valid (e.g., '2024-12-25' is valid, '2024-02-30' is not).
 */
function isValidISODate(dateStr: string): boolean {
  // Must match YYYY-MM-DD format exactly
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!isoDateRegex.test(dateStr)) {
    return false
  }

  // Parse the date and verify it's a real calendar date
  const [year, month, day] = dateStr.split('-').map(Number)
  const parsedDate = new Date(year, month - 1, day)

  // Check that the parsed date matches (handles invalid dates like Feb 30)
  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  )
}

export function getLocalISODate(): string {
  // Check for ant-only date override
  if (process.env.CLAUDE_CODE_OVERRIDE_DATE) {
    // Validate the override date is a valid ISO date string
    if (isValidISODate(process.env.CLAUDE_CODE_OVERRIDE_DATE)) {
      return process.env.CLAUDE_CODE_OVERRIDE_DATE
    }
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Memoized for prompt-cache stability — captures the date once at session start.
// The main interactive path gets this behavior via memoize(getUserContext) in
// context.ts; simple mode (--bare) calls getSystemPrompt per-request and needs
// an explicit memoized date to avoid busting the cached prefix at midnight.
// When midnight rolls over, getDateChangeAttachments appends the new date at
// the tail (though simple mode disables attachments, so the trade-off there is:
// stale date after midnight vs. ~entire-conversation cache bust — stale wins).
export const getSessionStartDate = memoize(getLocalISODate)

// Returns "Month YYYY" (e.g. "February 2026") in the user's local timezone.
// Changes monthly, not daily — used in tool prompts to minimize cache busting.
export function getLocalMonthYear(): string {
  if (process.env.CLAUDE_CODE_OVERRIDE_DATE) {
    // Validate the override date is a valid ISO date string before using it
    if (isValidISODate(process.env.CLAUDE_CODE_OVERRIDE_DATE)) {
      const date = new Date(process.env.CLAUDE_CODE_OVERRIDE_DATE)
      return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    }
  }
  const date = new Date()
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
