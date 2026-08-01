import React from "react"
import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import {
  SettingsPanel,
  settingsRows,
  isEntry,
  nextEntry,
  firstEntry,
} from "./settings-panel.js"
import { SyncList } from "./sync-list.js"
import { pairGlyph, pairIsHealthy } from "../lib/providers.js"

const CONFIG = {
  ignorePatterns: [".ds_store", "node_modules"],
  ignorePaths: ["/System"],
}

test("rows interleave headings with their entries", () => {
  expect(settingsRows(CONFIG).map((r) => r.kind)).toEqual([
    "heading",
    "entry",
    "entry",
    "heading",
    "entry",
  ])
})

// A heading is a label, not a destination. Landing on one and needing a second
// keypress to leave is the friction nobody reports and everybody feels.
test("the cursor skips headings in both directions", () => {
  const rows = settingsRows(CONFIG)
  expect(firstEntry(rows)).toBe(1)
  // Down from the last pattern jumps the "Ignored paths" heading entirely.
  expect(nextEntry(rows, 2, 1)).toBe(4)
  expect(nextEntry(rows, 4, -1)).toBe(2)
  // At the end, it stays put rather than landing on nothing.
  expect(nextEntry(rows, 4, 1)).toBe(4)
})

test("an entry knows which list it came from, so removal targets the right key", () => {
  const rows = settingsRows(CONFIG)
  const patterns = rows.filter(isEntry).filter((r) => r.list === "patterns")
  const paths = rows.filter(isEntry).filter((r) => r.list === "paths")
  expect(patterns.map((r) => r.value)).toEqual([".ds_store", "node_modules"])
  expect(paths.map((r) => r.value)).toEqual(["/System"])
})

test("an empty config still renders both headings", () => {
  const frame =
    render(
      <SettingsPanel
        settings={{ ignorePatterns: [], ignorePaths: [] }}
        rows={10}
      />,
    ).lastFrame() ?? ""
  expect(frame).toContain("Ignored names")
  expect(frame).toContain("Ignored paths")
})

const PAIR = {
  id: 1,
  local: "~/pCloud/Documents",
  remote: "Documents",
  files: 590,
  queued: 0,
  issues: [],
}

// Glyph and colour say the same thing, so the state survives without colour.
test("health is readable from the glyph alone", () => {
  expect(pairIsHealthy(PAIR)).toBe(true)
  expect(pairGlyph(PAIR)).toBe("✓")
  expect(pairGlyph({ ...PAIR, issues: ["stuck"] })).toBe("✗")
})

test("SyncList names a pair whose remote is gone rather than leaving a gap", () => {
  const frame =
    render(
      <SyncList
        pairs={[{ ...PAIR, remote: undefined, issues: ["orphaned"] }]}
        rows={10}
      />,
    ).lastFrame() ?? ""
  expect(frame).toContain("(remote gone)")
})

test("SyncList shows a queue depth only when something is queued", () => {
  const busy =
    render(
      <SyncList pairs={[{ ...PAIR, queued: 2 }]} rows={10} />,
    ).lastFrame() ?? ""
  expect(busy).toContain("2 queued")

  const idle = render(<SyncList pairs={[PAIR]} rows={10} />).lastFrame() ?? ""
  expect(idle).not.toContain("queued")
})

test("SyncList shows the empty state", () => {
  expect(render(<SyncList pairs={[]} rows={10} />).lastFrame() ?? "").toContain(
    "No sync pairs",
  )
})


