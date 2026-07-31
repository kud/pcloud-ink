import React from "react"
import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import type {
  PCloudDiffEntry,
  PCloudFolderItem,
  PCloudUserInfo,
  PCloudShareItem,
} from "@kud/pcloud"
import { FileList, sortItems } from "./file-list.js"
import { ChangesList } from "./changes-list.js"
import { AccountPanel } from "./account-panel.js"
import { ShareList, shareRights } from "./share-list.js"

const items: PCloudFolderItem[] = [
  {
    name: "zeta.txt",
    isfolder: false,
    size: 2048,
    modified: "Wed, 16 Oct 2024 21:41:39 +0000",
  },
  { name: "alpha", isfolder: true },
  { name: "beta.md", isfolder: false, size: 0 },
]

const entries: PCloudDiffEntry[] = [
  {
    diffid: 1,
    event: "createfile",
    time: "Thu, 30 Jul 2026 20:46:27 +0000",
    metadata: { name: "new.txt", isfolder: false },
  },
  {
    diffid: 2,
    event: "deletefolder",
    time: "Thu, 30 Jul 2026 20:46:28 +0000",
    metadata: { name: "gone", isfolder: true },
  },
]

test("FileList renders a row per item with kind and size", () => {
  const { lastFrame } = render(<FileList items={items} rows={10} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("zeta.txt")
  expect(frame).toContain("alpha")
  expect(frame).toContain("2 KB")
})

test("FileList marks directories with a trailing slash, not colour alone", () => {
  const { lastFrame } = render(<FileList items={sortItems(items)} rows={10} />)
  expect(lastFrame() ?? "").toContain("alpha/")
})

test("sortItems puts folders first, then alphabetical within each group", () => {
  expect(sortItems(items).map((i) => i.name)).toEqual([
    "alpha",
    "beta.md",
    "zeta.txt",
  ])
})

test("FileList shows the empty state rather than a bare header", () => {
  const { lastFrame } = render(<FileList items={[]} rows={10} />)
  expect(lastFrame() ?? "").toContain("Empty folder")
})

test("ChangesList labels events in text, so state survives without colour", () => {
  const { lastFrame } = render(<ChangesList entries={entries} rows={10} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("+ created")
  expect(frame).toContain("- deleted")
})

// The dir/file column is gone: the event name already carries it
// (createfolder vs createfile) and the panel states DIR or FILE outright, so a
// third restatement was only spending a column.
test("ChangesList marks folders with a trailing slash, not a kind column", () => {
  const { lastFrame } = render(<ChangesList entries={entries} rows={10} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("gone/")
  expect(frame).toContain("new.txt")
})

// The date moved into a day heading and the row keeps only a clock time —
// two hundred rows repeating the same date was the noise this replaced.
test("ChangesList puts the date in a heading and the time on the row", () => {
  const now = new Date("2026-07-31T12:00:00Z")
  const { lastFrame } = render(
    <ChangesList entries={entries} rows={10} now={now} />,
  )
  const frame = lastFrame() ?? ""
  expect(frame).toContain("Yesterday")
  expect(frame).not.toContain("+0000")
  expect(frame).not.toContain("30 Jul 2026")
})

test("ChangesList shows the empty state", () => {
  const { lastFrame } = render(<ChangesList entries={[]} rows={10} />)
  expect(lastFrame() ?? "").toContain("No changes")
})

test("AccountPanel reports quota as used, total and percentage", () => {
  const user: PCloudUserInfo = {
    result: 0,
    email: "someone@example.com",
    quota: 2_000_000_000,
    usedquota: 500_000_000,
    plan: 3,
  }
  const { lastFrame } = render(<AccountPanel user={user} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("someone@example.com")
  expect(frame).toContain("25%")
})

test("AccountPanel does not divide by zero on an unknown quota", () => {
  const user: PCloudUserInfo = {
    result: 0,
    email: "someone@example.com",
    quota: 0,
    usedquota: 0,
    plan: 1,
  }
  const { lastFrame } = render(<AccountPanel user={user} />)
  expect(lastFrame() ?? "").toContain("0%")
})

const shares = [
  {
    shareid: 225308,
    folderid: 1,
    foldername: "Lib",
    tomail: "someone@example.com",
    canread: true,
    canmodify: true,
    cancreate: false,
    candelete: false,
    created: "Sun, 09 Oct 2022 22:19:32 +0000",
  },
] as never as PCloudShareItem[]

// Positional, not a list of what was granted: "rw--" and "r--d" both grant two
// rights, and a comma-separated summary cannot tell them apart at a glance.
test("shareRights renders every right in a fixed position", () => {
  expect(shareRights(shares[0])).toBe("rw--")
  expect(shareRights({ canread: true, candelete: true } as never)).toBe("r--d")
  expect(shareRights({} as never)).toBe("----")
})

test("ShareList leads with the share id, which is what remove-share takes", () => {
  const { lastFrame } = render(<ShareList shares={shares} rows={10} />)
  const line = (lastFrame() ?? "").split("\n").find((l) => l.includes("Lib"))
  expect(line?.trimStart().startsWith("225308")).toBe(true)
})

test("ShareList names the counterparty by direction", () => {
  const out = render(<ShareList shares={shares} rows={10} direction="outgoing" />)
  expect(out.lastFrame() ?? "").toContain("someone@example.com")

  const incoming = [{ ...shares[0], tomail: undefined, frommail: "owner@example.com" }] as never
  const inc = render(<ShareList shares={incoming} rows={10} direction="incoming" />)
  expect(inc.lastFrame() ?? "").toContain("owner@example.com")
})

test("ShareList shows the empty state", () => {
  const { lastFrame } = render(<ShareList shares={[]} rows={10} />)
  expect(lastFrame() ?? "").toContain("No shares")
})
