import sys

with open('src/memdir/teamMemPaths.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the isTeamMemPath function
idx = content.find('export function isTeamMemPath')
if idx < 0:
    print('Function not found')
    sys.exit(1)

# Find the end of the function (next closing brace at column 0)
end_idx = content.find('\n}', idx)
if end_idx < 0:
    print('End not found')
    sys.exit(1)
end_idx += 2  # include the closing brace and newline

old_func = content[idx:end_idx]
print('OLD FUNCTION:')
print(repr(old_func))
print('---')

new_func = '''export function isTeamMemPath(filePath: string): boolean {
  // SECURITY: resolve() converts to absolute and eliminates .. segments,
  // preventing path traversal attacks (e.g. "team/../../etc/passwd")
  const resolvedPath = resolve(filePath)
  const teamDir = getTeamMemPath()
  if (!resolvedPath.startsWith(teamDir)) {
    return false
  }
  // Second pass: resolve symlinks on the deepest existing ancestor and verify
  // the real path is still within the real team dir. This catches symlink-based
  // escapes that path.resolve() alone cannot detect (PSR M22186).
  try {
    const realPath = realpathDeepestExistingSync(resolvedPath)
    return isRealPathWithinTeamDirSync(realPath)
  } catch {
    // PathTraversalError or unexpected error - fail closed.
    return false
  }
}
'''

content = content[:idx] + new_func + content[end_idx:]

# Also update the comment above isTeamMemPath
old_comment = '''/**
 * Check if a resolved absolute path is within the team memory directory.
 * Uses path.resolve() to convert relative paths and eliminate traversal segments.
 * Does NOT resolve symlinks - for write validation use validateTeamMemWritePath()
 * or validateTeamMemKey() which include symlink resolution.
 */'''

new_comment = '''/**
 * Check if a resolved absolute path is within the team memory directory.
 * Uses path.resolve() to convert relative paths and eliminate traversal segments.
 * Resolves symlinks on the deepest existing ancestor to prevent symlink-based
 * escapes (PSR M22186), consistent with validateTeamMemWritePath() and
 * validateTeamMemKey().
 */'''

if old_comment in content:
    content = content.replace(old_comment, new_comment)
    print('Comment updated')
else:
    print('Comment not found (may use different dash character)')
    # Try to find and replace the comment
    comment_idx = content.rfind('/**', 0, idx)
    if comment_idx >= 0:
        comment_end = content.find('*/', comment_idx) + 2
        old_c = content[comment_idx:comment_end]
        print('Found comment:', repr(old_c))
        content = content[:comment_idx] + new_comment + content[comment_end:]
        print('Comment replaced')

with open('src/memdir/teamMemPaths.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('Done')
