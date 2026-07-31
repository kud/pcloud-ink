import type { PCloudDiffEntry } from "@kud/pcloud"
import { isFolderEvent } from "./event.js"

// The diff stream is one row per event, which is what pCloud stores but not
// what anyone reads: a file saved every three minutes for two hours produces
// forty rows that say the same thing, under two hundred repetitions of the same
// date. Folding a day's events on one file into a single run, under one day
// heading, is the difference between a log and a history.

export type EventRun = {
  key: string
  event: string
  name: string
  path?: string
  fileid?: number
  folderid?: number
  isFolder: boolean
  count: number
  /** Oldest event in the run — where a rewind of the whole run starts. */
  first: PCloudDiffEntry
  /** Newest event in the run — what a single-row recovery acts on. */
  last: PCloudDiffEntry
  entries: PCloudDiffEntry[]
}

export type RewindRow =
  | { kind: "day"; key: string; label: string; count: number }
  | { kind: "run"; key: string; run: EventRun; expanded: boolean }
  | { kind: "event"; key: string; entry: PCloudDiffEntry; run: EventRun }

const dayKey = (time: string): string => {
  const at = new Date(time)
  return Number.isNaN(at.getTime()) ? "unknown" : at.toDateString()
}

const DAY_MS = 86_400_000

export const dayLabel = (time: string, now: Date): string => {
  const at = new Date(time)
  if (Number.isNaN(at.getTime())) return "Undated"

  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const daysApart = Math.round((midnight(now) - midnight(at)) / DAY_MS)

  if (daysApart === 0) return "Today"
  if (daysApart === 1) return "Yesterday"
  if (daysApart < 7)
    return at.toLocaleDateString(undefined, { weekday: "long" })
  return at.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export const relativeAge = (time: string, now: Date): string => {
  const at = new Date(time)
  if (Number.isNaN(at.getTime())) return ""

  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export const clockTime = (time: string): string => {
  const at = new Date(time)
  if (Number.isNaN(at.getTime())) return "--:--"
  return at.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

const SPARK = "▁▂▃▄▅▆▇█"

// Where a run's activity actually fell across its own span, rather than how
// much of it there was — a burst and a steady trickle produce the same count.
export const sparkline = (times: string[], buckets = 8): string => {
  const stamps = times
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t))
  if (stamps.length < 2) return ""

  const start = Math.min(...stamps)
  const end = Math.max(...stamps)
  if (end === start) return ""

  const counts = new Array(buckets).fill(0)
  for (const stamp of stamps) {
    const slot = Math.min(
      buckets - 1,
      Math.floor(((stamp - start) / (end - start)) * buckets),
    )
    counts[slot] += 1
  }

  const peak = Math.max(...counts)
  return counts
    .map((n) =>
      n === 0
        ? SPARK[0]
        : SPARK[Math.min(SPARK.length - 1, Math.ceil((n / peak) * 7))],
    )
    .join("")
}

// Grouping is per day and per target, not per consecutive pair: the same file
// saved either side of an unrelated event is still the same file, and a run
// broken in two by one interloper is the noise this exists to remove.
const runKey = (entry: PCloudDiffEntry): string => {
  const meta = entry.metadata ?? {}
  const target = meta.fileid ?? meta.folderid ?? meta.name ?? "?"
  return `${dayKey(entry.time)}|${entry.event}|${target}`
}

export const buildRuns = (entries: PCloudDiffEntry[]): EventRun[] => {
  const runs = new Map<string, EventRun>()

  for (const entry of entries) {
    const key = runKey(entry)
    const existing = runs.get(key)
    if (existing) {
      existing.count += 1
      existing.entries.push(entry)
      // Callers hand these over newest-first, so anything appended is older.
      existing.first = entry
      continue
    }

    const meta = entry.metadata ?? {}
    runs.set(key, {
      key,
      event: entry.event,
      name: meta.name ?? "?",
      path: meta.path,
      fileid: meta.fileid,
      folderid: meta.folderid,
      isFolder: isFolderEvent(entry.event),
      count: 1,
      first: entry,
      last: entry,
      entries: [entry],
    })
  }

  return [...runs.values()]
}

export const buildRows = (
  entries: PCloudDiffEntry[],
  expanded: ReadonlySet<string>,
  now: Date,
): RewindRow[] => {
  const rows: RewindRow[] = []
  let currentDay: string | null = null

  const runs = buildRuns(entries)

  for (const run of runs) {
    const day = dayKey(run.last.time)
    if (day !== currentDay) {
      currentDay = day
      rows.push({
        kind: "day",
        key: `day:${day}`,
        label: dayLabel(run.last.time, now),
        count: runs
          .filter((r) => dayKey(r.last.time) === day)
          .reduce((total, r) => total + r.count, 0),
      })
    }

    const isExpanded = expanded.has(run.key) && run.count > 1
    rows.push({ kind: "run", key: run.key, run, expanded: isExpanded })

    if (isExpanded) {
      for (const entry of run.entries) {
        rows.push({
          kind: "event",
          key: `${run.key}:${entry.diffid}`,
          entry,
          run,
        })
      }
    }
  }

  return rows
}

export const isSelectable = (row: RewindRow | undefined): boolean =>
  row !== undefined && row.kind !== "day"

// A day heading is a label, not a destination. Landing on one and needing a
// second keypress to leave it is the kind of friction nobody reports and
// everybody feels.
export const nextSelectable = (
  rows: RewindRow[],
  from: number,
  step: 1 | -1,
): number => {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (isSelectable(rows[i])) return i
  }
  return from
}

export const firstSelectable = (rows: RewindRow[]): number =>
  rows.findIndex(isSelectable) === -1 ? 0 : rows.findIndex(isSelectable)
