with open('src/memdir/teamMemPaths.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# The line should be:
#     realTeamDir = realpathSync(getTeamMemPath().replace(/[/\\]+$/, ''))
# But it currently has only one backslash:
#     realTeamDir = realpathSync(getTeamMemPath().replace(/[/\]+$/, ''))

# Use raw strings to avoid escaping issues
old = r"realpathSync(getTeamMemPath().replace(/[/\]+$/, ''))"
new = r"realpathSync(getTeamMemPath().replace(/[/\\]+$/, ''))"

if old in content:
    content = content.replace(old, new)
    print('Fixed regex')
else:
    print('Pattern not found')
    # Debug: find the line
    for i, line in enumerate(content.split('\n')):
        if 'realpathSync(getTeamMemPath' in line:
            print(f'Line {i+1}: {repr(line)}')

with open('src/memdir/teamMemPaths.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('Done')
