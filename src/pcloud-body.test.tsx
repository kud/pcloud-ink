import { test, expect } from "vitest"
import { trashItemToRow, recoveryFor } from "./pcloud-body.js"

// A trashed folder has no deletetime, and new Date(NaN).toISOString() throws
// rather than returning something harmless — so this crashed the whole Trash
// view on the first folder it met, which is the common case.
test("a trashed folder without a deletetime does not throw", () => {
  const row = trashItemToRow({
    folderid: 1234567890,
    name: "documents",
  } as never)

  expect(row.name).toBe("documents")
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
  expect(row.modified).toBe("14 Nov 2023")
})

// A folder deletion carries folderid and no fileid. Keying recovery off fileid
// alone offered no action at all on the events that fill the trash, so enter
// looked broken on exactly the rows that most needed it.
test("a deleted folder recovers by folderid", () => {
  expect(
    recoveryFor({
      diffid: 1,
      event: "deletefolder",
      time: "Fri, 31 Jul 2026 18:56:35 +0000",
      metadata: { folderid: 42, name: "archives" },
    }),
  ).toEqual({ kind: "restoreFolder", folderid: 42 })
})

test("a deleted file recovers by fileid", () => {
  expect(
    recoveryFor({
      diffid: 2,
      event: "deletefile",
      time: "Fri, 31 Jul 2026 18:56:35 +0000",
      metadata: { fileid: 7, name: "notes.md" },
    }),
  ).toEqual({ kind: "restoreFile", fileid: 7 })
})

test("an edit reverts by fileid", () => {
  expect(
    recoveryFor({
      diffid: 3,
      event: "modifyfile",
      time: "Fri, 31 Jul 2026 18:56:35 +0000",
      metadata: { fileid: 7, name: "notes.md" },
    }),
  ).toEqual({ kind: "revert", fileid: 7 })
})

test("a creation has no recovery, since undoing it would delete real data", () => {
  expect(
    recoveryFor({
      diffid: 4,
      event: "createfile",
      time: "Fri, 31 Jul 2026 18:56:35 +0000",
      metadata: { fileid: 7, name: "notes.md" },
    }),
  ).toBeUndefined()
})
