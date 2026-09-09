import re, difflib, sys
sys.stdout.reconfigure(encoding='utf-8')
src = open('src/memdir/memoryTypes.ts', encoding='utf-8').read()
m1 = re.search(r'TYPES_SECTION_COMBINED: readonly string\[\] = \[(.*?)\n\]', src, re.S)
m2 = re.search(r'TYPES_SECTION_INDIVIDUAL: readonly string\[\] = \[(.*?)\n\]', src, re.S)
a1 = [l.strip() for l in m1.group(1).split('\n')]
a2 = [l.strip() for l in m2.group(1).split('\n')]
print('len1', len(a1), 'len2', len(a2))
for l in difflib.unified_diff(a1, a2, lineterm='', n=1):
    print(l)
