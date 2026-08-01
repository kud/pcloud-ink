import React from "react"
import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import { TrashList, trashId, deletedOn } from "./trash-list.js"
import { PublinkList, publinkExpiry } from "./publink-list.js"
import { RevisionList, byNewest } from "./revision-list.js"

// A trashed folder carries folderid and no fileid, and restore-trash needs
// whichever one exists — reading fileid alone worked only on a loose file at
// the root, which is the rarer case by far.
test("trashId prefers folderid, since trash is mostly folders", () => {
  expect(trashId({ folderid: 42, name: "gone" } as never)).toBe("42")
  expect(trashId({ fileid: 7, name: "notes.md" } as never)).toBe("7")
  expect(trashId({ name: "orphan" } as never)).toBe("-")
})

// new Date(NaN).toISOString() throws rather than degrading, and a trashed
// folder has no deletetime at all — this once killed the whole Trash view.
test("deletedOn survives a missing or unparseable deletetime", () => {
  expect(deletedOn({ deletetime: 1_700_000_000 } as never)).toBe("14 Nov 2023")
  expect(deletedOn({ name: "folder" } as never)).toBe("-")
  expect(deletedOn({ deletetime: Number.NaN } as never)).toBe("-")
})

test("TrashList marks folders with a slash and shows the restore id", () => {
  const { lastFrame } = render(
    <TrashList
      items={[{ folderid: 42, name: "documents" }] as never}
      rows={10}
    />,
  )
  const frame = lastFrame() ?? ""
  expect(frame).toContain("documents/")
  expect(frame).toContain("42")
  expect(frame).toContain("dir")
})

test("TrashList shows the empty state", () => {
  const { lastFrame } = render(<TrashList items={[]} rows={10} />)
  expect(lastFrame() ?? "").toContain("Trash is empty")
})

// A blank expiry column reads as missing data, when it is in fact the most
// consequential thing a public link can tell you.
test("publinkExpiry says never rather than leaving a gap", () => {
  expect(publinkExpiry({ code: "abc" } as never)).toBe("never")
  expect(
    publinkExpiry({
      code: "abc",
      expire: "Fri, 31 Jul 2026 00:00:00 +0000",
    } as never),
  ).toContain("31 Jul 2026")
})

test("PublinkList leads with the code, which delete-publink takes", () => {
  const { lastFrame } = render(
    <PublinkList
      links={[{ code: "XZabc123", name: "report.pdf", downloads: 4 }] as never}
      rows={10}
    />,
  )
  const line = (lastFrame() ?? "").split("\n").find((l) => l.includes("report"))
  expect(line?.trimStart().startsWith("XZabc123")).toBe(true)
})

// Shipped twice as a bug: taking revisions[0] from an API that promises no
// order reverts far further back than "the previous version".
test("byNewest orders by revisionid regardless of what the API returned", () => {
  const revs = [
    { revisionid: 3, size: 1 },
    { revisionid: 9, size: 1 },
    { revisionid: 5, size: 1 },
  ] as never as Parameters<typeof byNewest>[0]

  expect(byNewest(revs).map((r) => r.revisionid)).toEqual([9, 5, 3])
})

test("byNewest does not mutate what it was handed", () => {
  const revs = [{ revisionid: 1 }, { revisionid: 2 }] as never
  byNewest(revs)
  expect((revs as { revisionid: number }[]).map((r) => r.revisionid)).toEqual([
    1, 2,
  ])
})

test("RevisionList marks the newest, which is what revert usually means", () => {
  const { lastFrame } = render(
    <RevisionList
      revisions={
        [
          { revisionid: 3, size: 100 },
          { revisionid: 9, size: 200 },
        ] as never
      }
      rows={10}
    />,
  )
  const lines = (lastFrame() ?? "").split("\n").filter(Boolean)
  expect(lines[0]).toContain("9")
  expect(lines[0]).toContain("latest")
  expect(lines[1]).not.toContain("latest")
})
