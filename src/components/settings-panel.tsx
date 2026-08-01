import React from "react"
import { Box, Text } from "ink"
import { SelectableRow, colors } from "@kud/ink-ui"
import { windowSlice } from "../lib/window.js"
import { fit } from "../lib/fit.js"
import type { SettingsView } from "../lib/providers.js"

export type SettingsRow =
  | { kind: "heading"; key: string; label: string; count: number }
  | { kind: "entry"; key: string; value: string; list: "patterns" | "paths" }

export type SettingsPanelProps = {
  settings: SettingsView
  selected?: number
  rows: number
}

// One flat list with headings, so a single cursor walks both rules. Two
// side-by-side columns would need a focus concept the rest of the browser does
// not have, for two lists nobody edits at the same time.
export const settingsRows = (settings: SettingsView): SettingsRow[] => [
  {
    kind: "heading",
    key: "h:patterns",
    label: "Ignored names",
    count: settings.ignorePatterns.length,
  },
  ...settings.ignorePatterns.map((value) => ({
    kind: "entry" as const,
    key: `p:${value}`,
    value,
    list: "patterns" as const,
  })),
  {
    kind: "heading",
    key: "h:paths",
    label: "Ignored paths",
    count: settings.ignorePaths.length,
  },
  ...settings.ignorePaths.map((value) => ({
    kind: "entry" as const,
    key: `a:${value}`,
    value,
    list: "paths" as const,
  })),
]

export const isEntry = (
  row: SettingsRow | undefined,
): row is Extract<SettingsRow, { kind: "entry" }> => row?.kind === "entry"

// A heading is a label, not a destination — landing on one and needing a second
// keypress to leave is the friction nobody reports and everybody feels.
export const nextEntry = (
  rows: SettingsRow[],
  from: number,
  step: 1 | -1,
): number => {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (isEntry(rows[i])) return i
  }
  return from
}

export const firstEntry = (rows: SettingsRow[]): number => {
  const at = rows.findIndex(isEntry)
  return at === -1 ? 0 : at
}

export const SettingsPanel = ({
  settings,
  selected = -1,
  rows,
}: SettingsPanelProps) => {
  const all = settingsRows(settings)
  const { items: visible, offset } = windowSlice(
    all,
    Math.max(0, selected),
    rows,
  )

  return (
    <Box flexDirection="column">
      {visible.map((row, i) => {
        const idx = offset + i
        if (row.kind === "heading")
          return (
            <Box key={row.key} marginTop={idx === 0 ? 0 : 1}>
              <Text bold color={colors.muted}>
                {row.label}
              </Text>
              <Text color={colors.muted}>{`  ${row.count}`}</Text>
            </Box>
          )
        return (
          <SelectableRow key={row.key} active={idx === selected}>
            <Text wrap="truncate-end">
              <Text color={colors.muted}>{"  "}</Text>
              <Text>{fit(row.value, 40)}</Text>
            </Text>
          </SelectableRow>
        )
      })}
    </Box>
  )
}
