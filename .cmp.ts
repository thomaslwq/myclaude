import { TYPES_SECTION_COMBINED, TYPES_SECTION_INDIVIDUAL } from './src/memdir/memoryTypes.ts'

const a1 = [...TYPES_SECTION_COMBINED]
const a2 = [...TYPES_SECTION_INDIVIDUAL]

function blocks(a: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  let cur = ''
  let buf: string[] = []
  for (const line of a) {
    const mm = line.match(/<name>(\w+)<\/name>/)
    if (mm) {
      if (cur) m.set(cur, buf)
      cur = mm[1]
      buf = []
    } else if (cur) {
      buf.push(line)
    }
  }
  if (cur) m.set(cur, buf)
  return m
}

const b1 = blocks(a1)
const b2 = blocks(a2)
for (const t of ['user', 'feedback', 'project', 'reference']) {
  const x = b1.get(t) ?? []
  const y = b2.get(t) ?? []
  console.log('===', t, 'C:', x.length, 'I:', y.length)
  const xs = new Set(x)
  const ys = new Set(y)
  for (const line of x) {
    if (!ys.has(line)) console.log('  ONLY-C:', JSON.stringify(line))
  }
  for (const line of y) {
    if (!xs.has(line)) console.log('  ONLY-I:', JSON.stringify(line))
  }
}
