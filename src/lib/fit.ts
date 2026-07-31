// Pad AND truncate to an exact width. padEnd alone only ever grows a string, so
// any value longer than its column silently runs into the next one — a trashed
// file called '"8 Folders" from 30 Jul 2026 16:00.zip' pushed the size column
// off the row entirely. Every fixed-width column wants this, not padEnd.
//
// The ellipsis is a single character, so the visible text loses one more
// character than the overflow strictly requires; that keeps the total width
// exact, which is the whole point.
export const fit = (text: string, width: number): string => {
  if (width <= 0) return ""
  if (text.length === width) return text
  if (text.length < width) return text.padEnd(width)
  return width === 1 ? "…" : `${text.slice(0, width - 2)}… `
}
