import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render } from "ink-testing-library"
import { PCloudBody } from "./pcloud-body.js"
import type { PCloudAPI } from "@kud/pcloud"
import type { SettingsView, SyncPairView } from "./lib/providers.js"

// The assembled browser is ~2,000 lines and was the one piece with no test at
// all — the list components underneath it were covered, the shell that decides
// which of them to show was not. Mounting it needs an authenticated client,
// which is exactly why it now takes one as a prop: reaching for a global
// credential and calling process.exit from inside a render is not something a
// test can survive, nor a consumer recover from.

const FOLDER = {
  result: 0,
  metadata: {
    folderid: 1,
    contents: [
      { name: "Documents", isfolder: true, folderid: 10 },
      { name: "notes.md", isfolder: false, fileid: 20, size: 1024 },
    ],
  },
}

const api = (overrides: Record<string, unknown> = {}) =>
  ({
    listFolder: vi.fn(async () => FOLDER),
    listShares: vi.fn(async () => ({
      result: 0,
      shares: {
        outgoing: [
          {
            shareid: 1,
            folderid: 10,
            foldername: "Documents",
            tomail: "someone@example.com",
            canread: true,
          },
        ],
        incoming: [],
      },
    })),
    diff: vi.fn(async () => ({ result: 0, entries: [] })),
    listTrash: vi.fn(async () => ({ result: 0, contents: [] })),
    listFolderById: vi.fn(async () => ({ result: 0, metadata: {} })),
    ...overrides,
  }) as unknown as PCloudAPI

// Ink renders asynchronously and the browser loads on mount, so assertions
// need a tick before the first frame is meaningful.
const settled = () => new Promise((r) => setTimeout(r, 60))

const mount = (props: Record<string, unknown> = {}) =>
  render(<PCloudBody onExit={() => {}} api={api()} {...props} />)

const PAIRS: SyncPairView[] = [
  {
    id: 1,
    local: "~/pCloud/Documents",
    remote: "Documents",
    files: 12,
    queued: 0,
    issues: [],
  },
]

const CONFIG: SettingsView = {
  ignorePatterns: ["node_modules"],
  ignorePaths: ["/System"],
}

describe("which tabs exist", () => {
  // A host with no local pCloud database should not be offered a view that
  // could only ever be empty.
  it("shows four tabs when the host supplies no providers", async () => {
    const { lastFrame } = mount()
    await settled()
    const frame = lastFrame() ?? ""
    for (const tab of ["Files", "Rewind", "Trash", "Shares"])
      expect(frame).toContain(tab)
    expect(frame).not.toContain("Sync")
    expect(frame).not.toContain("Settings")
  })

  it("adds Sync only when a sync provider is given", async () => {
    const { lastFrame } = mount({ sync: () => PAIRS })
    await settled()
    expect(lastFrame() ?? "").toContain("Sync")
    expect(lastFrame() ?? "").not.toContain("Settings")
  })

  it("adds Settings only when a settings provider is given", async () => {
    const { lastFrame } = mount({
      settings: { read: () => CONFIG, write: () => {} },
    })
    await settled()
    expect(lastFrame() ?? "").toContain("Settings")
  })

  it("shows all six when the host can supply both", async () => {
    const { lastFrame } = mount({
      sync: () => PAIRS,
      settings: { read: () => CONFIG, write: () => {} },
    })
    await settled()
    const frame = lastFrame() ?? ""
    for (const tab of [
      "Files",
      "Rewind",
      "Trash",
      "Shares",
      "Sync",
      "Settings",
    ])
      expect(frame).toContain(tab)
  })
})

describe("the file list", () => {
  it("renders the folder it was given", async () => {
    const { lastFrame } = mount()
    await settled()
    const frame = lastFrame() ?? ""
    expect(frame).toContain("Documents/")
    expect(frame).toContain("notes.md")
  })

  // A share is a property of a folder rather than a place, so the tab alone
  // would leave the file list silent about it.
  it("marks a folder that is shared out", async () => {
    const { lastFrame } = mount()
    await settled()
    expect(lastFrame() ?? "").toContain("shared")
  })

  it("asks for the folder it was told to open", async () => {
    const client = api()
    render(<PCloudBody onExit={() => {}} api={client} />)
    await settled()
    expect(client.listFolder).toHaveBeenCalledWith("/")
  })
})

describe("credentials", () => {
  // The point of the prop: no credential store is consulted, and nothing
  // exits.
  it("uses the client it is handed rather than the stored one", async () => {
    const client = api()
    render(<PCloudBody onExit={() => {}} api={client} />)
    await settled()
    expect(client.listFolder).toHaveBeenCalled()
  })
})

describe("failure", () => {
  // The providers are read when their tab is opened, not at mount — the local
  // database is a file another process holds a lock on, and reading it eagerly
  // would cost that on every launch for a tab you may never visit.
  const TAB = "\t"

  it("survives a sync provider that throws", async () => {
    const { lastFrame, stdin } = mount({
      sync: () => {
        throw new Error("database is locked")
      },
    })
    await settled()
    // Files → Rewind → Trash → Shares → Sync
    for (let i = 0; i < 4; i++) {
      stdin.write(TAB)
      await settled()
    }
    expect(lastFrame() ?? "").toContain("database is locked")
  })

  it("survives a settings provider that throws", async () => {
    const { lastFrame, stdin } = mount({
      sync: () => PAIRS,
      settings: {
        read: () => {
          throw new Error("cannot read settings")
        },
        write: () => {},
      },
    })
    await settled()
    // …→ Sync → Settings
    for (let i = 0; i < 5; i++) {
      stdin.write(TAB)
      await settled()
    }
    expect(lastFrame() ?? "").toContain("cannot read settings")
  })
})

describe("navigating between tabs", () => {
  it("tab moves forward through the tabs the host enabled", async () => {
    const { lastFrame, stdin } = mount({ sync: () => PAIRS })
    await settled()
    stdin.write("\t")
    await settled()
    // Rewind loads the change log rather than leaving the file list on screen
    // under a new heading.
    expect(lastFrame() ?? "").toContain("No recent changes")
  })
})
