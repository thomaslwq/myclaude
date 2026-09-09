import re, json, sys
sys.stdout.reconfigure(encoding='utf-8')
src = open('src/memdir/memoryTypes.ts', encoding='utf-8').read()

def parse_array(name):
    m = re.search(r'export const ' + name + r': readonly string\[\] = \[(.*?)\n\]', src, re.S)
    body = m.group(1)
    items = []
    for line in body.split('\n'):
        s = line.strip()
        if not s:
            continue
        if s.endswith(','):
            s = s[:-1]
        q = s[0]
        inner = s[1:-1]
        if q == '"':
            val = inner.replace('\\"', '"').replace('\\\\', '\\')
        else:
            val = inner.replace("\\'", "'").replace('\\\\', '\\')
        items.append(val)
    return items

a1 = parse_array('TYPES_SECTION_COMBINED')
a2 = parse_array('TYPES_SECTION_INDIVIDUAL')
print('len1', len(a1), 'len2', len(a2))
open('.a1.json','w',encoding='utf-8').write(json.dumps(a1, ensure_ascii=False, indent=1))
open('.a2.json','w',encoding='utf-8').write(json.dumps(a2, ensure_ascii=False, indent=1))
