import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatBytes, formatDate, type PCloudTrashItem } from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type TrashListProps = {
  items: (PCloudTrashItem & { folderid?: number })[]
  selected?: number
  rows: number
  emptyText?: string
}

// Trash is mostly folders — a folder deletion is what fills it — and those
// carry folderid rather than fileid. Showing whichever one exists matters
// because it is the argument restore-trash takes.
export const trashId = (
  item: PCloudTrashItem & { folderid?: number },
): string => String(item.folderid ?? item.fileid ?? "-")

// A trashed folder has no deletetime, and new Date(NaN) does not degrade
// politely — it throws on toISOString. The whole Trash view once died on the
// first folder it met for exactly this reason.
export const deletedOn = (item: PCloudTrashItem): string => {
  if (!item.deletetime) return "-"
  const at = new Date(item.deletetime * 1000)
  return Number.isNaN(at.getTime()) ? "-" : formatDate(at.toUTCString())
}

// Controlled, windowed trash listing, laid out to match FileList.
export const TrashList = ({
  items,
  selected = -1,
  rows,
  emptyText = "Trash is empty",
}: TrashListProps) => {
  if (!items.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    items,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((item, i) => {
        const idx = offset + i
        const isFolder = item.folderid !== undefined
        return (
          <SelectableRow key={trashId(item) + idx} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text color={colors.muted}>
                {fit(isFolder ? "dir" : "file", 6)}
              </Text>
              <Text color={colors.muted}>{fit(trashId(item), 13)}</Text>
              <Text bold={isFolder}>
                {fit(`${item.name}${isFolder ? "/" : ""}`, 38)}
              </Text>
              <Text color={colors.info}>
                {fit(isFolder ? "-" : formatBytes(item.size ?? 0), 12)}
              </Text>
              <Text color={colors.muted}>{deletedOn(item)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
