import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import type { PCloudShareItem } from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type ShareListProps = {
  shares: PCloudShareItem[]
  /** "outgoing" names the recipient column, "incoming" names the owner. */
  direction?: "outgoing" | "incoming"
  selected?: number
  rows: number
  emptyText?: string
}

// An accepted share reports four booleans rather than the bitmask that creates
// one. Rendering them positionally keeps "r--d" distinguishable from "rw--",
// which a comma-separated list of the granted ones cannot do.
export const shareRights = (share: PCloudShareItem): string =>
  [
    share.canread ? "r" : "-",
    share.canmodify ? "w" : "-",
    share.cancreate ? "c" : "-",
    share.candelete ? "d" : "-",
  ].join("")

// Date only. A full timestamp pushed the row past the terminal edge and
// truncated to "03…", which tells you less than nothing — and the time of day a
// share was created has never been the interesting part.
export const shareDate = (created: string | undefined): string => {
  if (!created) return ""
  const at = new Date(created)
  return Number.isNaN(at.getTime())
    ? ""
    : at.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
}

// Controlled, windowed share listing, laid out to match FileList — a folder is
// a folder whichever command surfaced it, so `list-shares` should not read like
// output from a different program than `ls`.
export const ShareList = ({
  shares,
  direction = "outgoing",
  selected = -1,
  rows,
  emptyText = "No shares",
}: ShareListProps) => {
  if (!shares.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    shares,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((share, i) => {
        const idx = offset + i
        const who =
          direction === "outgoing"
            ? (share.tomail ?? "-")
            : (share.frommail ?? "-")
        return (
          <SelectableRow key={share.shareid ?? idx} active={idx === selected}>
            <Text wrap="truncate-end">
              {/* shareid first, because it is the argument remove-share takes
                  and hunting for it in a trailing column is the common task. */}
              <Text color={colors.muted}>
                {fit(String(share.shareid ?? "-"), 9)}
              </Text>
              <Text bold>
                {fit(`${share.foldername ?? share.folderid}/`, 24)}
              </Text>
              <Text color={colors.info}>{fit(who, 30)}</Text>
              <Text color={colors.muted}>{fit(shareRights(share), 6)}</Text>
              <Text color={colors.muted}>{shareDate(share.created)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
