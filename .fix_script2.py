import sys

with open('src/memdir/teamMemPaths.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the comment before isTeamMemPath
idx = content.find('/**\n * Check if a resolved absolute path is within the team memory directory.')
if idx < 0:
    print('Comment not found')
    sys.exit(1)

sync_helpers = '''/**
 * Synchronous version of realpathDeepestExisting for use in synchronous
 * code paths (e.g. isTeamMemPath).
 */
function realpathDeepestExistingSync(absolutePath: string): string {
  const tail: string[] = []
  let current = absolutePath
  let iterations = 0
  for (
    let parent = dirname(current);
    current !== parent;
    parent = dirname(current)
  ) {
    if (++iterations > MAX_REALPATH_DEPTH) {
      throw new PathTraversalError(
        `Path depth exceeds maximum allowed (${MAX_REALPATH_DEPTH}): "${absolutePath}"`,
      )
    }
    try {
      const realCurrent = realpathSync(current)
      return tail.length === 0
        ? realCurrent
        : join(realCurrent, ...tail.reverse())
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        try {
          const st = lstatSync(current)
          if (st.isSymbolicLink()) {
            throw new PathTraversalError(
              `Dangling symlink detected (target does not exist): "${current}"`,
            )
          }
        } catch (lstatErr: unknown) {
          if (lstatErr instanceof PathTraversalError) {
            throw lstatErr
          }
        }
      } else if (code === 'ELOOP') {
        throw new PathTraversalError(
          `Symlink loop detected in path: "${current}"`,
        )
      } else if (code !== 'ENOTDIR' && code !== 'ENAMETOOLONG') {
        throw new PathTraversalError(
          `Cannot verify path containment (${code}): "${current}"`,
        )
      }
      tail.push(current.slice(parent.length + sep.length))
      current = parent
    }
  }
  return absolutePath
}

/**
 * Synchronous version of isRealPathWithinTeamDir for use in synchronous
 * code paths (e.g. isTeamMemPath).
 */
function isRealPathWithinTeamDirSync(
  realCandidate: string,
): boolean {
  let realTeamDir: string
  try {
    realTeamDir = realpathSync(getTeamMemPath().replace(/[/\\]+$/, ''))
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return true
    }
    return false
  }
  if (realCandidate === realTeamDir) {
    return true
  }
  return realCandidate.startsWith(realTeamDir + sep)
}

'''

content = content[:idx] + sync_helpers + content[idx:]

with open('src/memdir/teamMemPaths.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('Done')
