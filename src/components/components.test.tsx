import React from "react"
import { test, expect } from "vitest"
import { render } from "ink-testing-library"
import type {
  PCloudDiffEntry,
  PCloudFolderItem,
  PCloudUserInfo,
} from "@kud/pcloud"
import { FileList, sortItems } from "./file-list.js"
import { ChangesList } from "./changes-list.js"
import { AccountPanel } from "./account-panel.js"

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

test("ChangesList distinguishes folder events from file events", () => {
  const { lastFrame } = render(<ChangesList entries={entries} rows={10} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("dir")
  expect(frame).toContain("file")
})

test("ChangesList strips the weekday and offset from timestamps", () => {
  const { lastFrame } = render(<ChangesList entries={entries} rows={10} />)
  const frame = lastFrame() ?? ""
  expect(frame).toContain("30 Jul 2026 20:46:27")
  expect(frame).not.toContain("+0000")
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
