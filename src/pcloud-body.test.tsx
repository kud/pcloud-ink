import { test, expect } from "vitest"
import { trashItemToRow } from "./pcloud-body.js"

// A trashed folder has no deletetime, and new Date(NaN).toISOString() throws
// rather than returning something harmless — so this crashed the whole Trash
// view on the first folder it met, which is the common case.
test("a trashed folder without a deletetime does not throw", () => {
  const row = trashItemToRow({
    folderid: 25673131029,
    name: "claude-personal",
  } as never)

  expect(row.name).toBe("claude-personal")
  expect(row.isfolder).toBe(true)
  expect(row.modified).toBeUndefined()
})

test("a trashed folder keeps its folderid, which is what restores it", () => {
  const row = trashItemToRow({ folderid: 42, name: "gone" } as never)
  expect(row.folderid).toBe(42)
  expect(row.fileid).toBeUndefined()
})

test("a trashed file keeps its deletion date and reads as a file", () => {
  const row = trashItemToRow({
    fileid: 7,
    name: "notes.md",
    size: 1024,
    deletetime: 1_700_000_000,
  } as never)

  expect(row.isfolder).toBe(false)
  expect(row.fileid).toBe(7)
  expect(row.modified).toBe("2023-11-14")
})
