import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"
import {
  pairGlyph,
  pairIsHealthy,
  type SyncPairView,
} from "../lib/providers.js"

export type SyncListProps = {
  pairs: SyncPairView[]
  selected?: number
  rows: number
  emptyText?: string
}

// Controlled, windowed listing of the local sync pairs, laid out to match
// FileList. Read-only by design: pCloud keys a pair by the local folder's inode
// and indexes it across three further tables, so creating one by hand hands a
// daemon a pair it never built — and the failure mode is deleted local files
// rather than a sync that simply fails to start.
export const SyncList = ({
  pairs,
  selected = -1,
  rows,
  emptyText = "No sync pairs on this machine",
}: SyncListProps) => {
  if (!pairs.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    pairs,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((pair, i) => {
        const idx = offset + i
        const healthy = pairIsHealthy(pair)
        return (
          <SelectableRow key={pair.id} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text color={healthy ? colors.success : colors.error} bold>
                {`${pairGlyph(pair)} `}
              </Text>
              <Text bold>{fit(pair.local, 28)}</Text>
              {/* A pair whose remote is gone is the zombie state: folderid is
                  ON DELETE SET NULL, so deleting the cloud folder blanks the
                  reference rather than removing the pair. */}
              <Text color={pair.remote ? colors.info : colors.error}>
                {fit(pair.remote ?? "(remote gone)", 22)}
              </Text>
              <Text color={colors.muted}>{fit(`${pair.files} files`, 14)}</Text>
              <Text color={pair.queued > 0 ? colors.error : colors.muted}>
                {pair.queued > 0 ? `${pair.queued} queued` : ""}
              </Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
