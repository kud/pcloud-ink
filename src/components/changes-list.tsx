import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatTimestamp, type PCloudDiffEntry } from "@kud/pcloud"
import { eventTone, isFolderEvent } from "../lib/event.js"
import { windowSlice } from "../lib/window.js"

export type ChangesListProps = {
  entries: PCloudDiffEntry[]
  selected?: number
  rows: number
  emptyText?: string
}

// Columns are boxes with widths rather than padded strings: Ink lays out each
// <Text> as its own node and trims trailing whitespace, so padEnd survives only
// until a value changes width and the columns drift apart.
const TIME_WIDTH = 21
const EVENT_WIDTH = 11
const KIND_WIDTH = 5

// Controlled, windowed list of account change events. Each row is
// "<time> <glyph> <label> <kind> <name>" — the glyph and label distinguish
// created/modified/deleted without relying on the row colour.
export const ChangesList = ({
  entries,
  selected = -1,
  rows,
  emptyText = "No changes",
}: ChangesListProps) => {
  if (!entries.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items, offset } = windowSlice(entries, Math.max(0, selected), rows)

  return (
    <Box flexDirection="column">
      {items.map((entry, i) => {
        const idx = offset + i
        const tone = eventTone(entry.event)
        const meta = entry.metadata ?? {}
        return (
          <SelectableRow key={entry.diffid ?? idx} active={idx === selected}>
            <Box>
              <Box width={TIME_WIDTH} flexShrink={0}>
                <Text color={colors.muted}>{formatTimestamp(entry.time)}</Text>
              </Box>
              <Box width={EVENT_WIDTH} flexShrink={0}>
                <Text color={tone.color} bold>
                  {`${tone.glyph} ${tone.label}`}
                </Text>
              </Box>
              <Box width={KIND_WIDTH} flexShrink={0}>
                <Text color={colors.muted}>
                  {isFolderEvent(entry.event) ? "dir" : "file"}
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text wrap="truncate-end">{meta.path ?? meta.name ?? "-"}</Text>
              </Box>
            </Box>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
