import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import type { PCloudDiffEntry } from "@kud/pcloud"
import { eventTone, isFolderEvent } from "../lib/event.js"
import { windowSlice } from "../lib/window.js"
import {
  buildRows,
  clockTime,
  relativeAge,
  type RewindRow,
} from "../lib/rewind-rows.js"

export type ChangesListProps = {
  entries: PCloudDiffEntry[]
  selected?: number
  rows: number
  emptyText?: string
  expanded?: ReadonlySet<string>
  now?: Date
  /** Resolved full paths by diffid, filled in after the list first renders. */
  paths?: ReadonlyMap<number, string>
}

// Columns are boxes with widths rather than padded strings: Ink lays out each
// <Text> as its own node and trims trailing whitespace, so padEnd survives only
// until a value changes width and the columns drift apart.
const TIME_WIDTH = 7
const EVENT_WIDTH = 11
const COUNT_WIDTH = 5
const AGE_WIDTH = 9

const DayHeading = ({ label, count }: { label: string; count: number }) => (
  <Box marginTop={1}>
    <Text color={colors.muted} bold>
      {label}
    </Text>
    <Text
      color={colors.muted}
    >{`  ${count} change${count === 1 ? "" : "s"}`}</Text>
  </Box>
)

const Columns = ({
  time,
  tone,
  count,
  label,
  age,
  indent,
  dim,
}: {
  time: string
  tone?: { glyph: string; label: string; color: string }
  count?: number
  label: string
  age?: string
  indent?: boolean
  dim?: boolean
}) => (
  <Box width="100%">
    <Box width={TIME_WIDTH + (indent ? 2 : 0)} flexShrink={0}>
      <Text color={colors.muted}>{`${indent ? "  " : ""}${time}`}</Text>
    </Box>
    <Box width={EVENT_WIDTH} flexShrink={0}>
      {tone ? (
        <Text color={tone.color} bold={!dim}>
          {`${tone.glyph} ${tone.label}`}
        </Text>
      ) : null}
    </Box>
    <Box width={COUNT_WIDTH} flexShrink={0}>
      <Text color={colors.muted}>
        {count !== undefined && count > 1 ? `×${count}` : ""}
      </Text>
    </Box>
    {/* The name column is the only one allowed to shrink: an overflowing row
        compresses every flexible column regardless of flexShrink, so a long
        path used to drag the fixed columns out of alignment with the rest. */}
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      <Text wrap="truncate-start" dimColor={dim}>
        {label}
      </Text>
    </Box>
    <Box width={AGE_WIDTH} flexShrink={0} justifyContent="flex-end">
      <Text color={colors.muted}>{age ?? ""}</Text>
    </Box>
  </Box>
)

// Windowed history of account changes, folded into one row per file per day.
// Each row is "<time> <glyph> <label> <count> <path> <age>"; the glyph and
// label distinguish created/modified/deleted without relying on row colour.
export const ChangesList = ({
  entries,
  selected = -1,
  rows,
  emptyText = "No changes",
  expanded = new Set<string>(),
  now = new Date(),
  paths,
}: ChangesListProps) => {
  if (!entries.length) return <Text color={colors.muted}>{emptyText}</Text>

  const all = buildRows(entries, expanded, now)
  const { items, offset } = windowSlice(all, Math.max(0, selected), rows)

  // A trailing slash marks a folder, matching FileList — the dropped dir/file
  // column said the same thing in five columns, and the event name already
  // distinguishes deletefolder from deletefile for anything reading the data.
  const pathOf = (entry: PCloudDiffEntry): string => {
    const label =
      paths?.get(entry.diffid) ??
      entry.metadata?.path ??
      entry.metadata?.name ??
      "-"
    return isFolderEvent(entry.event) ? `${label}/` : label
  }

  const render = (row: RewindRow, index: number) => {
    if (row.kind === "day")
      return <DayHeading key={row.key} label={row.label} count={row.count} />

    const active = index === selected

    if (row.kind === "event")
      return (
        <SelectableRow key={row.key} active={active}>
          <Columns
            indent
            dim
            time={clockTime(row.entry.time)}
            label={pathOf(row.entry)}
            age={relativeAge(row.entry.time, now)}
          />
        </SelectableRow>
      )

    const { run } = row
    const tone = eventTone(run.event)
    // A collapsed run hides its own span, so the marker has to say there is
    // something underneath rather than leaving the count to imply it.
    const marker = run.count > 1 ? (row.expanded ? "▾ " : "▸ ") : ""

    return (
      <SelectableRow key={row.key} active={active}>
        <Columns
          time={clockTime(run.last.time)}
          tone={tone}
          count={run.count}
          label={`${marker}${pathOf(run.last)}`}
          age={relativeAge(run.last.time, now)}
        />
      </SelectableRow>
    )
  }

  return (
    <Box flexDirection="column">
      {items.map((row, i) => render(row, offset + i))}
    </Box>
  )
}
