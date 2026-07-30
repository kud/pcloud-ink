// Visible slice that keeps the selected row in view (centred when it can be),
// plus the offset of the first visible item. Windowing lives here so every list
// component scrolls identically. The parent still owns the selection index —
// this is pure maths, no state.
export const windowSlice = <T>(
  items: T[],
  selected: number,
  rows: number,
): { items: T[]; offset: number } => {
  const r = Math.max(1, rows)
  if (items.length <= r) return { items, offset: 0 }
  const offset = Math.max(
    0,
    Math.min(selected - Math.floor(r / 2), items.length - r),
  )
  return { items: items.slice(offset, offset + r), offset }
}
