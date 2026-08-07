export type KeybindingContextName = string
export type KeybindingAction = string
export type ParsedKeystroke = {
  key?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}
export type Chord = ParsedKeystroke[]
export type ParsedBinding = {
  action: string
  chord: Chord
}
export type KeybindingBlock = {
  context?: KeybindingContextName
  bindings?: ParsedBinding[]
}
