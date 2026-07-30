import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatTimestamp, type PCloudDiffEntry } from "@kud/pcloud-sdk"
import { eventTone, isFolderEvent } from "../lib/event.js"
import { windowSlice } from "../lib/window.js"

export type ChangesListProps = {
  entries: PCloudDiffEntry[]
  selected?: number
  rows: number
  emptyText?: string
}

// Controlled, windowed list of account change events. Each row is
// "<time>  <glyph> <label>  <kind>  <name>" — the glyph and label distinguish
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
            <Text wrap="truncate-end">
              <Text color={colors.muted}>
                {formatTimestamp(entry.time).padEnd(21)}
              </Text>
              <Text color={tone.color} bold>
                {`${tone.glyph} ${tone.label}`.padEnd(11)}
              </Text>
              <Text color={colors.muted}>
                {(isFolderEvent(entry.event) ? "dir" : "file").padEnd(6)}
              </Text>
              <Text>{meta.path ?? meta.name ?? "-"}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
