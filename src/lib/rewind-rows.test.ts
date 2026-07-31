import { test, expect } from "vitest"
import {
  buildRuns,
  buildRows,
  dayLabel,
  relativeAge,
  sparkline,
  nextSelectable,
} from "./rewind-rows.js"

const NOW = new Date("2026-07-31T21:30:00Z")

const entry = (diffid: number, event: string, time: string, meta = {}) =>
  ({ diffid, event, time, metadata: meta }) as never

test("a day's events on one file collapse into a single run", () => {
  const runs = buildRuns([
    entry(3, "modifyfile", "2026-07-31T21:13:41Z", {
      fileid: 7,
      name: "u.tsv",
    }),
    entry(2, "modifyfile", "2026-07-31T20:31:42Z", {
      fileid: 7,
      name: "u.tsv",
    }),
    entry(1, "modifyfile", "2026-07-31T19:18:44Z", {
      fileid: 7,
      name: "u.tsv",
    }),
  ])

  expect(runs).toHaveLength(1)
  expect(runs[0].count).toBe(3)
  expect(runs[0].last.diffid).toBe(3)
  expect(runs[0].first.diffid).toBe(1)
})

// The run this was written for had an unrelated save sitting in the middle of
// it, so consecutive-only grouping would have split it in two.
test("an unrelated event between two saves does not split the run", () => {
  const runs = buildRuns([
    entry(3, "modifyfile", "2026-07-31T21:13:41Z", {
      fileid: 7,
      name: "u.tsv",
    }),
    entry(2, "modifyfile", "2026-07-31T19:07:22Z", {
      fileid: 9,
      name: "k.kdbx",
    }),
    entry(1, "modifyfile", "2026-07-31T18:59:36Z", {
      fileid: 7,
      name: "u.tsv",
    }),
  ])

  expect(runs).toHaveLength(2)
  expect(runs.find((r) => r.fileid === 7)?.count).toBe(2)
})

test("the same file on two days stays two runs", () => {
  const runs = buildRuns([
    entry(2, "modifyfile", "2026-07-31T10:00:00Z", {
      fileid: 7,
      name: "u.tsv",
    }),
    entry(1, "modifyfile", "2026-07-30T10:00:00Z", {
      fileid: 7,
      name: "u.tsv",
    }),
  ])
  expect(runs).toHaveLength(2)
})

test("a different event on the same file stays its own run", () => {
  const runs = buildRuns([
    entry(2, "deletefile", "2026-07-31T11:00:00Z", {
      fileid: 7,
      name: "u.tsv",
    }),
    entry(1, "modifyfile", "2026-07-31T10:00:00Z", {
      fileid: 7,
      name: "u.tsv",
    }),
  ])
  expect(runs).toHaveLength(2)
})

test("rows carry a day heading, and headings are not selectable", () => {
  const rows = buildRows(
    [
      entry(2, "modifyfile", "2026-07-31T10:00:00Z", { fileid: 7, name: "a" }),
      entry(1, "modifyfile", "2026-07-30T10:00:00Z", { fileid: 8, name: "b" }),
    ],
    new Set(),
    NOW,
  )

  expect(rows.map((r) => r.kind)).toEqual(["day", "run", "day", "run"])
  // From the first heading, down lands on the run beneath it, not the heading.
  expect(nextSelectable(rows, 0, 1)).toBe(1)
  // From the last run, down has nowhere to go and stays put.
  expect(nextSelectable(rows, 3, 1)).toBe(3)
  // Moving up from the second run skips its heading entirely.
  expect(nextSelectable(rows, 3, -1)).toBe(1)
})

test("expanding a run lists its individual events beneath it", () => {
  const entries = [
    entry(2, "modifyfile", "2026-07-31T11:00:00Z", { fileid: 7, name: "a" }),
    entry(1, "modifyfile", "2026-07-31T10:00:00Z", { fileid: 7, name: "a" }),
  ]
  const key = buildRuns(entries)[0].key

  expect(buildRows(entries, new Set(), NOW).map((r) => r.kind)).toEqual([
    "day",
    "run",
  ])
  expect(buildRows(entries, new Set([key]), NOW).map((r) => r.kind)).toEqual([
    "day",
    "run",
    "event",
    "event",
  ])
})

test("a single-event run does not expand, since there is nothing to reveal", () => {
  const entries = [
    entry(1, "modifyfile", "2026-07-31T10:00:00Z", { fileid: 7, name: "a" }),
  ]
  const key = buildRuns(entries)[0].key
  expect(buildRows(entries, new Set([key]), NOW).map((r) => r.kind)).toEqual([
    "day",
    "run",
  ])
})

test("day labels read as names near today and as dates further back", () => {
  expect(dayLabel("2026-07-31T09:00:00Z", NOW)).toBe("Today")
  expect(dayLabel("2026-07-30T09:00:00Z", NOW)).toBe("Yesterday")
  expect(dayLabel("not a date", NOW)).toBe("Undated")
})

test("relative age degrades from minutes to days", () => {
  expect(relativeAge("2026-07-31T21:29:40Z", NOW)).toBe("just now")
  expect(relativeAge("2026-07-31T21:00:00Z", NOW)).toBe("30m ago")
  expect(relativeAge("2026-07-31T18:30:00Z", NOW)).toBe("3h ago")
  expect(relativeAge("2026-07-28T21:30:00Z", NOW)).toBe("3d ago")
})

test("a sparkline needs a span to describe, and is empty without one", () => {
  expect(sparkline([])).toBe("")
  expect(sparkline(["2026-07-31T10:00:00Z"])).toBe("")
  expect(sparkline(["2026-07-31T10:00:00Z", "2026-07-31T10:00:00Z"])).toBe("")
})

test("a sparkline is one glyph per bucket across the run's own span", () => {
  const spark = sparkline([
    "2026-07-31T10:00:00Z",
    "2026-07-31T10:01:00Z",
    "2026-07-31T10:02:00Z",
    "2026-07-31T18:00:00Z",
  ])
  expect(spark).toHaveLength(8)
  // The burst at the start must not read the same as the lone later event.
  expect(spark[0]).not.toBe(spark[7])
})
