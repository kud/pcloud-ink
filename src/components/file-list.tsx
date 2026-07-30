import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import {
  formatBytes,
  formatTimestamp,
  type PCloudFolderItem,
} from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"

export type FileListProps = {
  items: PCloudFolderItem[]
  selected?: number
  rows: number
  emptyText?: string
}

// Folders sort above files, then each group alphabetically — the ordering a
// file browser is expected to have, applied here so every surface agrees.
export const sortItems = (items: PCloudFolderItem[]): PCloudFolderItem[] => [
  ...items
    .filter((item) => item.isfolder)
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...items
    .filter((item) => !item.isfolder)
    .sort((a, b) => a.name.localeCompare(b.name)),
]

// Controlled, windowed folder listing. Directories are marked with a trailing
// slash as well as the "dir" kind column, so type is never colour-only.
export const FileList = ({
  items,
  selected = -1,
  rows,
  emptyText = "Empty folder",
}: FileListProps) => {
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
        return (
          <SelectableRow
            key={item.folderid ?? item.fileid ?? idx}
            active={idx === selected}
          >
            <Text wrap="truncate-end">
              <Text color={colors.muted}>
                {(item.isfolder ? "dir" : "file").padEnd(6)}
              </Text>
              <Text bold={item.isfolder}>
                {`${item.name}${item.isfolder ? "/" : ""}`.padEnd(40)}
              </Text>
              <Text color={colors.info}>
                {(item.isfolder ? "-" : formatBytes(item.size ?? 0)).padEnd(12)}
              </Text>
              <Text color={colors.muted}>{formatTimestamp(item.modified)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
