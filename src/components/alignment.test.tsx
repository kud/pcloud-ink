import React from "react"
import { test, expect } from "vitest"
import { Box } from "ink"
import { render } from "ink-testing-library"
import { ChangesList } from "./changes-list.js"

// The first version of this test used only short names and passed while the bug
// survived: a row long enough to overflow its container compresses the fixed
// columns, so misalignment appeared only on long paths — which a real change log
// is full of. The narrow wrapper is what forces that overflow; without it the
// default width is roomy enough that nothing ever has to shrink.
const WIDTH = 60

test("names line up even when a path overflows the row", () => {
  const names = [
    "deeply/nested/directory/with/a/rather/long/path/name.txt",
    "notes.md",
    "another/quite/long/directory/path/that/will/not/fit.json",
    "README.md",
  ]
  const events = ["deletefolder", "deletefile", "modifyfile", "createfile"]

  const entries = names.map((name, i) => ({
    diffid: i,
    event: events[i],
    time: "Fri, 31 Jul 2026 00:59:55 +0000",
    metadata: { name, fileid: i },
  })) as never

  const { lastFrame } = render(
    <Box width={WIDTH}>
      <ChangesList entries={entries} rows={20} />
    </Box>,
  )
  // The first line is now the day heading, which has no columns to align.
  const lines = (lastFrame() ?? "")
    .split("\n")
    .filter(Boolean)
    .filter((line) => !line.includes("change"))

  expect(lines).toHaveLength(names.length)

  // Measure where the fixed columns end rather than where a name starts:
  // truncation is at the start now, so a long path shows its tail behind an
  // ellipsis and has no prefix left to search for. The width of the time,
  // event and count columns is the thing that used to collapse.
  const columns = lines.map(
    (line) => line.match(/^\s*\d\d:\d\d\s+\S \w+\s+/)?.[0].length ?? -1,
  )
  expect(columns.every((column) => column > 0)).toBe(true)
  expect(new Set(columns).size).toBe(1)
})
