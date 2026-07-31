import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatTimestamp, type PCloudShareItem } from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"

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
                {String(share.shareid ?? "-").padEnd(9)}
              </Text>
              <Text bold>
                {`${share.foldername ?? share.folderid}/`.padEnd(24)}
              </Text>
              <Text color={colors.info}>{who.padEnd(30)}</Text>
              <Text color={colors.muted}>{shareRights(share).padEnd(6)}</Text>
              <Text color={colors.muted}>{formatTimestamp(share.created)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
