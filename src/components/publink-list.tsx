import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { formatTimestamp, type PCloudPublink } from "@kud/pcloud"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"

export type PublinkListProps = {
  links: PCloudPublink[]
  selected?: number
  rows: number
  emptyText?: string
}

// "never" rather than a blank: an empty expiry column reads as missing data,
// when it is in fact the most consequential value a public link can have.
export const publinkExpiry = (link: PCloudPublink): string =>
  link.expire ? formatTimestamp(link.expire) : "never"

// Controlled, windowed listing of public links, laid out to match FileList.
// The code leads because it is what delete-publink takes.
export const PublinkList = ({
  links,
  selected = -1,
  rows,
  emptyText = "No public links",
}: PublinkListProps) => {
  if (!links.length) return <Text color={colors.muted}>{emptyText}</Text>

  const { items: visible, offset } = windowSlice(
    links,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((link, i) => {
        const idx = offset + i
        const isFolder = link.folderid !== undefined
        return (
          <SelectableRow key={link.code ?? idx} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text color={colors.muted}>{fit((link.code ?? "-"), 20)}</Text>
              <Text bold={isFolder}>
                {fit(`${link.name ?? "-"}${isFolder ? "/" : ""}`, 32)}
              </Text>
              <Text color={colors.info}>
                {fit(String(link.downloads ?? 0), 11)}
              </Text>
              <Text color={colors.muted}>{publinkExpiry(link)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
