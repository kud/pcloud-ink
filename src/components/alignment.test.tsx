import React from "react"
import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import { ChangesList } from "./changes-list.js"

// Padding with padEnd inside separate <Text> nodes looked aligned until a value
// changed width — Ink lays each out as its own box and trims trailing space. The
// guarantee worth pinning is the one that broke: rows whose event and kind
// differ in length still start their name at the same column.
test("names line up regardless of event or kind width", () => {
  const names = ["claude-personal", "CLAUDE.md", "usage.tsv", "new.md"]
  const events = ["deletefolder", "deletefile", "modifyfile", "createfile"]

  const entries = names.map((name, i) => ({
    diffid: i,
    event: events[i],
    time: "Fri, 31 Jul 2026 00:59:55 +0000",
    metadata: { name, fileid: i },
  })) as never

  const { lastFrame } = render(<ChangesList entries={entries} rows={10} />)
  const lines = (lastFrame() ?? "").split("\n").filter(Boolean)

  expect(lines).toHaveLength(names.length)

  const columns = lines.map((line, i) => line.indexOf(names[i]))
  expect(columns.every((c) => c > 0)).toBe(true)
  expect(new Set(columns).size).toBe(1)
})
