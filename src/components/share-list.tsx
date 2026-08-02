import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatDate, type PCloudShareItem } from "@kud/pcloud"
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

// The list pane gets roughly half the terminal — about 72 columns on a wide
// one — and the row has to end before that edge, not at it. A test holds these
// under the budget, because the row is truncate-end: overrunning does not wrap,
// it silently eats the rightmost columns. "rwc-…" is what that looks like.
export const SHARE_COLUMNS = { id: 7, folder: 20, who: 24, rights: 6, date: 11 }

export const SHARE_ROW_WIDTH = Object.values(SHARE_COLUMNS).reduce(
  (total, width) => total + width,
  0,
)

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
                {fit(String(share.shareid ?? "-"), SHARE_COLUMNS.id)}
              </Text>
              <Text bold>
                {fit(
                  `${share.foldername ?? share.folderid}/`,
                  SHARE_COLUMNS.folder,
                )}
              </Text>
              <Text color={colors.info}>{fit(who, SHARE_COLUMNS.who)}</Text>
              <Text color={colors.muted}>
                {fit(shareRights(share), SHARE_COLUMNS.rights)}
              </Text>
              <Text color={colors.muted}>{formatDate(share.created)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
