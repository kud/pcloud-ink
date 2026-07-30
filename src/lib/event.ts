import { colors } from "@kud/ink-ui"

export type EventTone = {
  glyph: string
  label: string
  color: string
}

// Glyph and label carry the meaning; colour only reinforces it. A viewer who
// cannot separate the red from the green still reads "- deleted" against
// "+ created", so no state here is distinguishable by hue alone.
const TONES: Record<string, EventTone> = {
  create: { glyph: "+", label: "created", color: colors.success },
  modify: { glyph: "~", label: "modified", color: colors.info },
  delete: { glyph: "-", label: "deleted", color: colors.error },
}

const FALLBACK: EventTone = {
  glyph: "·",
  label: "changed",
  color: colors.muted,
}

export const eventTone = (event: string): EventTone => {
  const match = Object.keys(TONES).find((prefix) => event.startsWith(prefix))
  return match ? TONES[match] : FALLBACK
}

export const isFolderEvent = (event: string): boolean =>
  event.endsWith("folder")
