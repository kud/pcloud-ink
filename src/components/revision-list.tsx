import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatBytes, formatTimestamp, type PCloudRevision } from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type RevisionListProps = {
  revisions: PCloudRevision[]
  selected?: number
  rows: number
  emptyText?: string
}

// pCloud promises no order here. Reverting to whichever revision happened to
// arrive first is how you undo far more than the last edit — a bug this
// codebase has shipped twice — so the newest leads and the order is ours.
export const byNewest = (revisions: PCloudRevision[]): PCloudRevision[] =>
  [...revisions].sort((a, b) => b.revisionid - a.revisionid)

// Controlled, windowed revision listing, laid out to match FileList. The
// revision id leads because it is what revert-revision takes.
export const RevisionList = ({
  revisions,
  selected = -1,
  rows,
  emptyText = "No revisions",
}: RevisionListProps) => {
  if (!revisions.length) return <Text color={colors.muted}>{emptyText}</Text>

  const ordered = byNewest(revisions)
  const { items: visible, offset } = windowSlice(
    ordered,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((rev, i) => {
        const idx = offset + i
        return (
          <SelectableRow key={rev.revisionid ?? idx} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text color={colors.muted}>
                {fit(String(rev.revisionid), 13)}
              </Text>
              {/* The newest revision is the one immediately behind the current
                  file, which is what "revert" almost always means. */}
              <Text bold={idx === 0}>
                {fit((idx === 0 ? "latest" : ""), 9)}
              </Text>
              <Text color={colors.info}>
                {fit(formatBytes(rev.size ?? 0), 13)}
              </Text>
              <Text color={colors.muted}>
                {formatTimestamp(rev.modified ?? rev.created)}
              </Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
