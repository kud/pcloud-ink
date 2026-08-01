import React, { useState, useEffect } from "react"
import { Box, Text, useInput, useWindowSize } from "ink"
import { Spinner, Tabs, TextInput, type TabItem } from "@kud/ink-ui"
import { ChangesList } from "./components/changes-list.js"
import { ShareList, shareRights } from "./components/share-list.js"
import { SyncList } from "./components/sync-list.js"
import {
  SettingsPanel,
  settingsRows,
  isEntry,
  nextEntry,
  firstEntry,
} from "./components/settings-panel.js"
import type {
  SettingsProvider,
  SettingsView,
  SyncPairView,
  SyncProvider,
} from "./lib/providers.js"
import { isFolderEvent } from "./lib/event.js"
import {
  buildRows,
  clockTime,
  firstSelectable,
  nextSelectable,
  relativeAge,
  sparkline,
  type EventRun,
  type RewindRow,
} from "./lib/rewind-rows.js"
import Image, { TerminalInfoProvider } from "ink-picture"
import open from "open"
import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import nodePath from "path"
import {
  PCloudAPI,
  PCloudFolderItem,
  PCloudTrashItem,
  PCloudDiffEntry,
  PCloudShareItem,
  resolveStoredAuth,
  planRewind,
  applyRewind,
  pathResolver,
} from "@kud/pcloud"

type Phase =
  | "loading"
  | "browsing"
  | "confirming"
  | "executing"
  | "result"
  | "imagePreviewing"
  | "actions"
  | "uploading"
type Mode = "files" | "trash" | "rewind" | "shares" | "sync" | "settings"

const parentPath = (path: string): string => {
  if (path === "/") return "/"
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path
  const parent = trimmed.slice(0, trimmed.lastIndexOf("/"))
  return parent === "" ? "/" : parent
}

// Falls back to the stored credential so the CLI can mount this with no props,
// but a host that already holds an authenticated client should pass one — a
// component library has no business reaching for a global credential, and
// calling process.exit from inside a render is not something a consumer can
// recover from or a test can survive.
const buildAPI = (provided?: PCloudAPI): PCloudAPI => {
  if (provided) return provided
  const api = resolveStoredAuth()
  if (!api) {
    console.error("Not authenticated. Run `pcloud login` first.")
    process.exit(1)
  }
  return api
}

const sortItems = (items: PCloudFolderItem[]): PCloudFolderItem[] => [
  ...items
    .filter((i) => i.isfolder)
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...items
    .filter((i) => !i.isfolder)
    .sort((a, b) => a.name.localeCompare(b.name)),
]

const FOLDER_ICON = "\uF07C "
const FILE_ICON = "\uF016 "

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatDate = (modified: string | undefined): string => {
  if (!modified) return ""
  return modified.slice(0, 10)
}

const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "tif",
])
const isImageFile = (name: string): boolean =>
  IMAGE_EXTS.has(name.split(".").pop()?.toLowerCase() ?? "")

const breadcrumbSegments = (
  path: string,
): { label: string; last: boolean }[] => {
  if (path === "/") return [{ label: "/", last: true }]
  const parts = path.split("/").filter(Boolean)
  return [
    { label: "/", last: false },
    ...parts.map((part, i) => ({ label: part, last: i === parts.length - 1 })),
  ]
}

// Live storage above, recovery below — the same split pCloud's own sidebar
// makes, since the Rewind and Trash views show things that are not in the tree
// any more and so have no breadcrumb to speak of.
// Built from what the host can supply rather than fixed: a consumer with no
// local pCloud database should not be offered a tab that could only ever be
// empty. Everything downstream reads this array, so the tab, the cycle order
// and the key hints all follow from one place.
const tabsFor = (has: {
  sync: boolean
  settings: boolean
}): TabItem<Mode>[] => [
  { value: "files", label: "Files" },
  { value: "rewind", label: "Rewind" },
  { value: "trash", label: "Trash" },
  { value: "shares", label: "Shares" },
  ...(has.sync ? [{ value: "sync" as const, label: "Sync" }] : []),
  ...(has.settings ? [{ value: "settings" as const, label: "Settings" }] : []),
]

const Header = ({
  path,
  mode,
  tabs,
}: {
  path: string
  mode: Mode
  tabs: TabItem<Mode>[]
}) => {
  const segments = breadcrumbSegments(path)
  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      <Tabs active={mode} items={tabs} />
      <Box marginTop={1}>
        {mode !== "files"
          ? null
          : segments.map((seg, i) => (
              <React.Fragment key={i}>
                {i === 0 ? (
                  <Text color="cyan" dimColor>
                    {seg.label}{" "}
                  </Text>
                ) : (
                  <>
                    {i > 1 && (
                      <Text color="white" dimColor>
                        {" "}
                        /{" "}
                      </Text>
                    )}
                    <Text color="white" bold={seg.last} dimColor={!seg.last}>
                      {seg.label}
                    </Text>
                  </>
                )}
              </React.Fragment>
            ))}
      </Box>
    </Box>
  )
}

type KeyHint = { key: string; label: string }

const KeyBadge = ({ hint }: { hint: KeyHint }) => (
  <Box marginRight={2}>
    <Text backgroundColor="blueBright" color="white" bold>
      {` ${hint.key} `}
    </Text>
    <Text color="white" dimColor>
      {` ${hint.label}`}
    </Text>
  </Box>
)

type HintPair = { key: string; label: string }

const HintRow = ({ hints }: { hints: HintPair[] }) => (
  <Box>
    {hints.map((h, i) => (
      <Box key={h.key} marginRight={i < hints.length - 1 ? 2 : 0}>
        <Text color="white" bold>
          {h.key}
        </Text>
        <Text dimColor> {h.label}</Text>
      </Box>
    ))}
  </Box>
)

const FILES_PRIMARY: HintPair[] = [
  { key: "\u2191\u2193", label: "navigate" },
  { key: "\u2192", label: "open folder" },
  { key: "\u2190", label: "go back" },
  { key: "enter", label: "actions" },
]

const FILES_SECONDARY: HintPair[] = [
  { key: "tab", label: "switch view" },
  { key: "u", label: "upload" },
  { key: "l", label: "copy link" },
  { key: "d", label: "delete" },
  { key: "r", label: "reload" },
  { key: "q", label: "quit" },
]

const SECONDARY_PRIMARY: HintPair[] = [
  { key: "\u2191\u2193", label: "navigate" },
  { key: "enter", label: "actions" },
]

const SECONDARY_SECONDARY: HintPair[] = [
  { key: "tab", label: "switch view" },
  { key: "r", label: "restore from trash" },
  { key: "q", label: "quit" },
]

// A day's saves on one file fold into a single row, so the arrows expand and
// collapse a run rather than descending a tree. Recovery and the bulk rewind
// both live in the action modal, since neither is a keystroke to hit by accident.
const REWIND_PRIMARY: HintPair[] = [
  { key: "\u2191\u2193", label: "navigate" },
  { key: "\u2192", label: "expand run" },
  { key: "\u2190", label: "collapse" },
  { key: "enter", label: "actions" },
]

const REWIND_SECONDARY: HintPair[] = [
  { key: "tab", label: "switch view" },
  { key: "r", label: "reload" },
  { key: "q", label: "quit" },
]

const SHARES_SECONDARY: HintPair[] = [
  { key: "tab", label: "switch view" },
  { key: "r", label: "reload" },
  { key: "q", label: "quit" },
]

// Sync is read-only, so it offers no enter action and says so by omission.
const SYNC_PRIMARY: HintPair[] = [{ key: "↑↓", label: "navigate" }]

const Footer = ({ count, mode }: { count: number; mode: Mode }) => {
  const primary =
    mode === "files"
      ? FILES_PRIMARY
      : mode === "rewind"
        ? REWIND_PRIMARY
        : mode === "sync"
          ? SYNC_PRIMARY
          : SECONDARY_PRIMARY
  const secondary =
    mode === "files"
      ? FILES_SECONDARY
      : mode === "rewind"
        ? REWIND_SECONDARY
        : mode === "shares" || mode === "sync" || mode === "settings"
          ? SHARES_SECONDARY
          : SECONDARY_SECONDARY
  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="single"
      borderColor="gray"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Box>
        <HintRow hints={primary} />
        <Box flexGrow={1} />
        <Text color="cyan" dimColor>
          {count} items
        </Text>
      </Box>
      <HintRow hints={secondary} />
    </Box>
  )
}

const ItemRow = ({
  item,
  selected,
  shared,
}: {
  item: PCloudFolderItem
  selected: boolean
  /** Which way a folder is shared, if it is. */
  shared?: "out" | "in"
}) => {
  const indicator = selected ? "\u276F" : " "
  const icon = item.isfolder ? FOLDER_ICON : FILE_ICON
  const sizeLabel = item.isfolder ? "-" : formatSize(item.size ?? 0)
  const dateLabel = formatDate(item.modified)

  return (
    <Box>
      <Text color="cyan" bold={selected}>
        {indicator}{" "}
      </Text>
      <Text
        color={item.isfolder ? "yellow" : "white"}
        dimColor={!item.isfolder}
      >
        {icon}
      </Text>
      {/* A trailing slash, matching FileList and `pcloud ls`. The icon beside
          it is a nerd-font glyph, which renders as a blank box in any terminal
          without the font — leaving directory-ness carried by colour alone. */}
      <Text bold={selected} color="white">
        {`${item.name}${item.isfolder ? "/" : ""}`}
      </Text>
      {/* An arrow, not a colour: which direction a folder is shared is the
          whole point, and "shared" alone leaves you guessing whether you gave
          access or were given it. */}
      {shared && (
        <Text color="magenta">
          {shared === "out" ? "  → shared" : "  ← shared"}
        </Text>
      )}
      <Box flexGrow={1} />
      <Text dimColor color={item.isfolder ? "white" : "cyan"}>
        {sizeLabel}
        {"  "}
      </Text>
      <Text dimColor color="white">
        {dateLabel}
      </Text>
    </Box>
  )
}

// Trash-root entries are mostly folders, which carry no deletetime — and
// new Date(NaN).toISOString() throws rather than degrading, so the whole view
// crashed on the first folder it met. Extracted so a test can pin that.
export const trashItemToRow = (
  item: PCloudTrashItem & { folderid?: number },
): PCloudFolderItem => ({
  fileid: item.fileid,
  folderid: item.folderid,
  name: item.name,
  isfolder: item.folderid !== undefined,
  size: item.size,
  modified: item.deletetime
    ? new Date(item.deletetime * 1000).toISOString().slice(0, 10)
    : undefined,
})

// What a change event can be undone with, if anything. A deleted folder is
// restored by folderid and a deleted file by fileid — the same split the Trash
// view already learnt — and an edit reverts to a revision. Deriving it once
// keeps the action offered and the call made from disagreeing about which id
// matters, which is how folder deletions came to offer no action at all.
export type RewindRecovery =
  | { kind: "restoreFolder"; folderid: number }
  | { kind: "restoreFile"; fileid: number }
  | { kind: "revert"; fileid: number }

export const recoveryFor = (
  entry: PCloudDiffEntry,
): RewindRecovery | undefined => {
  const meta = entry.metadata
  if (!meta) return undefined

  if (entry.event.startsWith("delete")) {
    if (isFolderEvent(entry.event))
      return meta.folderid === undefined
        ? undefined
        : { kind: "restoreFolder", folderid: meta.folderid }
    return meta.fileid === undefined
      ? undefined
      : { kind: "restoreFile", fileid: meta.fileid }
  }

  if (entry.event === "modifyfile" && meta.fileid !== undefined)
    return { kind: "revert", fileid: meta.fileid }

  // A creation has no inverse that is not itself a deletion, so it is listed
  // and never acted on.
  return undefined
}

const MD_EXTS = new Set(["md", "mdx", "markdown"])
const isMarkdownFile = (name: string): boolean =>
  MD_EXTS.has(name.split(".").pop()?.toLowerCase() ?? "")

const Preview = ({
  item,
  imageUrl,
  markdownLines,
  hint,
}: {
  item: PCloudFolderItem | undefined
  imageUrl?: string
  markdownLines?: string[]
  hint?: string
}) => {
  const { rows = 24 } = useWindowSize()
  // Two rows of slack, and a margin, because the native image protocols draw in
  // absolute pixels rather than being laid out in cells: ITerm2.js reserves
  // Math.ceil(px / cellSize) cells, so an image whose height is not an exact
  // multiple of the cell height claims one more cell than the box gave it and
  // paints over the panel border. Slack absorbs the rounding.
  const imageHeight = Math.max(8, rows - 12)

  return (
    <Box
      flexBasis="45%"
      flexDirection="column"
      borderLeft={true}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {item === undefined ? (
        <Text color="gray">No selection</Text>
      ) : (
        <>
          {/* No width, no height: ink-picture measures this box and fits the
              image to it at its own aspect ratio. Passing a size instead means
              computing the panel's inner width by hand — 45% less borders less
              padding — and a native-protocol image drawn from a guess that is
              one column optimistic is painted straight over the border, since
              it is positioned in pixels rather than laid out in cells.

              Protocol is auto-detected rather than pinned to halfBlock. A
              terminal with native image support then renders a real image, and
              halfBlock is what auto-detection falls back to anyway. */}
          {imageUrl && (
            <Box height={imageHeight} marginTop={1} flexDirection="column">
              <Image src={imageUrl} alt="loading…" />
            </Box>
          )}
          {markdownLines && markdownLines.length > 0 && (
            <Box flexDirection="column">
              {markdownLines.map((line, i) => (
                <Text key={i} wrap="truncate-end">
                  {line}
                </Text>
              ))}
            </Box>
          )}
          {!imageUrl && !markdownLines && (
            <Text color="white" bold wrap="wrap">
              {item.name}
            </Text>
          )}
          <Box marginTop={imageUrl || markdownLines ? 1 : 0}>
            {item.isfolder ? (
              <Text color="yellow" bold>
                DIR
              </Text>
            ) : (
              <Text color="cyan" bold>
                FILE
              </Text>
            )}
          </Box>
          {!item.isfolder && item.size !== undefined && (
            <Text dimColor color="white">
              {formatSize(item.size)}
            </Text>
          )}
          <Text dimColor color="white">
            {formatDate(item.modified)}
          </Text>
          <Box>
            <Text color="gray">{"id "}</Text>
            <Text color="gray">
              {item.isfolder
                ? String(item.folderid ?? "")
                : String(item.fileid ?? "")}
            </Text>
          </Box>
          <Text color="gray">────────────────</Text>
          <Text color="gray">
            {hint ?? (item.isfolder ? "\u2192 enter to open" : "enter to open")}
          </Text>
        </>
      )}
    </Box>
  )
}

// The Rewind panel describes a run rather than a file: how often it was
// touched, over what span, and where the activity actually fell. A count alone
// cannot distinguish a burst from a trickle, which is the thing worth knowing
// before undoing any of it.
const RunPreview = ({
  run,
  entry,
  path,
  now,
}: {
  run: EventRun | undefined
  entry: PCloudDiffEntry | undefined
  path: string | undefined
  now: Date
}) => (
  <Box
    flexBasis="45%"
    flexDirection="column"
    borderLeft={true}
    borderStyle="single"
    borderColor="gray"
    paddingX={1}
  >
    {run === undefined ? (
      <Text color="gray">No selection</Text>
    ) : (
      <>
        <Text color="white" bold wrap="truncate-start">
          {run.name}
        </Text>
        {path && path !== run.name && (
          <Text dimColor color="white" wrap="truncate-start">
            {path}
          </Text>
        )}
        <Box marginTop={1}>
          <Text color={run.isFolder ? "yellow" : "cyan"} bold>
            {run.isFolder ? "DIR" : "FILE"}
          </Text>
        </Box>
        {run.count > 1 ? (
          <>
            <Text dimColor color="white">
              {`${run.count} changes  ${clockTime(run.first.time)} → ${clockTime(run.last.time)}`}
            </Text>
            <Text color="cyan">
              {`${sparkline(run.entries.map((e) => e.time))}  across the run`}
            </Text>
          </>
        ) : (
          <Text dimColor color="white">
            {clockTime(run.last.time)}
          </Text>
        )}
        <Text dimColor color="white">
          {relativeAge((entry ?? run.last).time, now)}
        </Text>
        <Box>
          <Text color="gray">{"id "}</Text>
          <Text color="gray">{String(run.fileid ?? run.folderid ?? "")}</Text>
        </Box>
        <Text color="gray">{"────────────────"}</Text>
        <Text color="gray">
          {run.count > 1
            ? "→ expand · enter to recover or rewind"
            : "enter to recover or rewind"}
        </Text>
      </>
    )}
  </Box>
)

const SharePreview = ({
  share,
  direction,
}: {
  share: PCloudShareItem | undefined
  direction: "outgoing" | "incoming"
}) => (
  <Box
    flexBasis="45%"
    flexDirection="column"
    borderLeft={true}
    borderStyle="single"
    borderColor="gray"
    paddingX={1}
  >
    {share === undefined ? (
      <Text color="gray">No selection</Text>
    ) : (
      <>
        <Text color="white" bold wrap="truncate-start">
          {share.foldername ?? String(share.folderid)}
        </Text>
        <Box marginTop={1}>
          <Text color={direction === "outgoing" ? "magenta" : "cyan"} bold>
            {direction === "outgoing" ? "SHARED OUT" : "SHARED IN"}
          </Text>
        </Box>
        <Text dimColor color="white" wrap="truncate-start">
          {direction === "outgoing"
            ? (share.tomail ?? "-")
            : (share.frommail ?? "-")}
        </Text>
        <Box marginTop={1} flexDirection="column">
          {/* Spelled out rather than left as rwcd: this panel has the room,
              and "can delete" is worth reading before revoking or trusting. */}
          <Text dimColor color="white">
            {`${share.canread ? "✓" : "·"} read`}
          </Text>
          <Text dimColor color="white">
            {`${share.canmodify ? "✓" : "·"} modify`}
          </Text>
          <Text dimColor color="white">
            {`${share.cancreate ? "✓" : "·"} create`}
          </Text>
          <Text dimColor color="white">
            {`${share.candelete ? "✓" : "·"} delete`}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">{`share id ${share.shareid}`}</Text>
        </Box>
        <Text color="gray">{"────────────────"}</Text>
        <Text color="gray">
          {direction === "outgoing"
            ? "enter to stop sharing"
            : "shared with you — nothing to revoke"}
        </Text>
      </>
    )}
  </Box>
)

const ImagePreview = ({
  imagePath,
  onExit,
}: {
  imagePath: string
  onExit: () => void
}) => {
  useEffect(() => {
    process.stdout.write("\x1b[H")
    try {
      execFileSync("imgcat", [imagePath], { stdio: "inherit" })
    } catch {
      process.stdout.write(
        "  imgcat not available — install with: brew install imgcat\n",
      )
    }
    process.stdout.write("\n  press any key to return\n")
  }, [imagePath])

  useInput(() => onExit())

  return <Box />
}

export type PCloudBodyProps = {
  /** Called when the user quits. The host owns the terminal lifecycle. */
  onExit: () => void
  /**
   * Reads this machine's pCloud sync pairs. Omit it and the Sync tab is absent
   * — the data lives in a local SQLite database, which a rendering package has
   * no business opening.
   */
  sync?: SyncProvider
  /** Reads and writes pCloud Drive's local client settings. Omit for no tab. */
  settings?: SettingsProvider
  /**
   * An authenticated client. Omit and the stored credential is used, which is
   * what the CLI wants; pass one when the host already holds a session, or
   * when mounting this without a credential store at all.
   */
  api?: PCloudAPI
}

export const PCloudBody = ({
  onExit,
  sync,
  settings,
  api: providedApi,
}: PCloudBodyProps) => {
  const [phase, setPhase] = useState<Phase>("loading")
  const [mode, setMode] = useState<Mode>("files")
  const [path, setPath] = useState("/")
  const [items, setItems] = useState<PCloudFolderItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [confirmAction, setConfirmAction] = useState("")
  const [pendingAction, setPendingAction] = useState<
    (() => Promise<void>) | null
  >(null)
  const [resultMessage, setResultMessage] = useState("")
  const [actionCursor, setActionCursor] = useState(0)
  const [resultIsError, setResultIsError] = useState(false)
  const [trashItems, setTrashItems] = useState<PCloudTrashItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<number | undefined>()
  const [pairs, setPairs] = useState<SyncPairView[]>([])
  const [pairsReadAt, setPairsReadAt] = useState<Date | undefined>()
  const [config, setConfig] = useState<SettingsView>({
    ignorePatterns: [],
    ignorePaths: [],
  })
  const TABS = React.useMemo(
    () =>
      tabsFor({ sync: sync !== undefined, settings: settings !== undefined }),
    [sync, settings],
  )
  const [changes, setChanges] = useState<PCloudDiffEntry[]>([])
  const [outgoing, setOutgoing] = useState<PCloudShareItem[]>([])
  const [incoming, setIncoming] = useState<PCloudShareItem[]>([])
  // folderid → direction, so the Files list can mark a shared folder without
  // asking about each row. One listshares call answers for the whole tree.
  const [sharedFolders, setSharedFolders] = useState<
    ReadonlyMap<number, "out" | "in">
  >(new Map())
  const [expandedRuns, setExpandedRuns] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [changePaths, setChangePaths] = useState<ReadonlyMap<number, string>>(
    new Map(),
  )
  // Relative ages are only honest if the clock they are measured against keeps
  // moving. A minute is finer than the labels this feeds ("2m ago", "3h ago").
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  // Built here as well as inside ChangesList, from the same inputs: the cursor
  // indexes rows rather than events, so key handling needs the same list the
  // renderer draws. buildRows is pure, so the two cannot disagree.
  const rewindRows: RewindRow[] = React.useMemo(
    () => buildRows(changes, expandedRuns, now),
    [changes, expandedRuns, now],
  )
  const api = React.useMemo(() => buildAPI(providedApi), [providedApi])
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [previewImageItem, setPreviewImageItem] = useState<string | null>(null)
  const [previewMarkdownLines, setPreviewMarkdownLines] = useState<
    string[] | null
  >(null)
  const [previewMarkdownItem, setPreviewMarkdownItem] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (phase !== "browsing") return
    const selected = items[cursor]
    if (!selected || selected.isfolder || !selected.fileid) {
      setPreviewImageUrl(null)
      setPreviewImageItem(null)
      setPreviewMarkdownLines(null)
      setPreviewMarkdownItem(null)
      return
    }

    if (isImageFile(selected.name) && previewImageItem !== selected.name) {
      setPreviewImageUrl(null)
      setPreviewImageItem(null)
      api
        .getFileLink(selected.fileid)
        .then((res) => {
          if (!res.hosts || !res.path) return
          setPreviewImageUrl(`https://${res.hosts[0]}${res.path}`)
          setPreviewImageItem(selected.name)
        })
        .catch(() => {})
      return
    }

    if (
      isMarkdownFile(selected.name) &&
      previewMarkdownItem !== selected.name
    ) {
      setPreviewMarkdownLines(null)
      setPreviewMarkdownItem(null)
      const ext = selected.name.split(".").pop()?.toLowerCase() ?? "md"
      const tmpPath = `/tmp/pcloud-preview.${ext}`
      api
        .getFileLink(selected.fileid)
        .then(async (res) => {
          if (!res.hosts || !res.path) return
          const url = `https://${res.hosts[0]}${res.path}`
          const imgRes = await fetch(url)
          const buf = await imgRes.arrayBuffer()
          fs.writeFileSync(tmpPath, Buffer.from(buf))
          try {
            const out = execFileSync(
              "glow",
              ["--no-pager", "-w", "40", tmpPath],
              {
                stdio: ["ignore", "pipe", "ignore"],
                env: {
                  ...process.env,
                  COLORTERM: "truecolor",
                  TERM: "xterm-256color",
                },
              },
            ).toString()
            setPreviewMarkdownLines(out.split("\n").slice(0, 30))
            setPreviewMarkdownItem(selected.name)
          } catch {
            setPreviewMarkdownLines(["glow not installed"])
            setPreviewMarkdownItem(selected.name)
          }
        })
        .catch(() => {})
      return
    }

    if (!isImageFile(selected.name) && !isMarkdownFile(selected.name)) {
      setPreviewImageUrl(null)
      setPreviewImageItem(null)
      setPreviewMarkdownLines(null)
      setPreviewMarkdownItem(null)
    }
  }, [cursor, items, phase])

  const showResult = (message: string, isError = false) => {
    setResultMessage(message)
    setResultIsError(isError)
    setPhase("result")
  }

  const runAction = async (action: () => Promise<void>) => {
    setPhase("executing")
    try {
      await action()
    } catch (err) {
      showResult(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
        true,
      )
    }
  }

  const loadFiles = (targetPath: string) => {
    setPhase("loading")
    api
      .listFolder(targetPath)
      .then((response) => {
        const contents = response.metadata?.contents ?? []
        setCurrentFolderId(response.metadata?.folderid)
        setItems(sortItems(contents))
        setCursor(0)
        setPhase("browsing")
      })
      .catch((err) => {
        console.error(`Error: ${err instanceof Error ? err.message : err}`)
        process.exit(1)
      })
  }

  // Paths are resolved after the list is already on screen. Every folder the
  // diff stream does not describe costs a listfolder round trip, and blocking
  // the whole view on those would trade a readable label for a visible stall —
  // so the names render first and grow into paths a moment later.
  const resolvePaths = (entries: PCloudDiffEntry[]) => {
    const toPath = pathResolver(api, entries)
    Promise.all(
      entries.map(
        async (entry) => [entry.diffid, await toPath(entry)] as const,
      ),
    )
      .then((pairs) => setChangePaths(new Map(pairs)))
      .catch(() => {})
  }

  // Loaded once and reused by both the Shares tab and the Files marker rather
  // than fetched per view: the answer is account-wide and does not change
  // while you walk the tree.
  const loadShares = () => {
    api
      .listShares()
      .then((response) => {
        const out = response.shares?.outgoing ?? []
        const inc = response.shares?.incoming ?? []
        setOutgoing(out)
        setIncoming(inc)
        setSharedFolders(
          new Map([
            ...out.map((s) => [s.folderid, "out"] as const),
            ...inc.map((s) => [s.folderid, "in"] as const),
          ]),
        )
      })
      .catch(() => {})
  }

  // Returns whether it worked, so the caller can leave the error on screen
  // rather than replacing it with an empty tab.
  const loadPairs = (): boolean => {
    if (!sync) return false
    try {
      setPairs(sync())
      // A reload that finds identical data changes nothing on screen, so
      // without a timestamp `r` looks broken even though it re-read the whole
      // database. The clock is the only honest proof it did anything.
      setPairsReadAt(new Date())
      return true
    } catch (error) {
      showResult(error instanceof Error ? error.message : String(error), true)
      return false
    }
  }

  const loadConfig = (): boolean => {
    if (!settings) return false
    try {
      setConfig(settings.read())
      return true
    } catch (error) {
      showResult(error instanceof Error ? error.message : String(error), true)
      return false
    }
  }

  const loadChanges = () => {
    setPhase("loading")
    api
      .diff({ last: 200 })
      .then((response) => {
        const entries = (response.entries ?? []).slice().reverse()
        setChanges(entries)
        setChangePaths(new Map())
        setExpandedRuns(new Set())
        setCursor(firstSelectable(buildRows(entries, new Set(), now)))
        setPhase("browsing")
        resolvePaths(entries)
      })
      .catch((error: unknown) => {
        showResult(error instanceof Error ? error.message : String(error), true)
      })
  }

  // Each view owns what it loads, so switching never leaves the previous view's
  // rows on screen under a new tab's heading.
  const switchTo = (next: Mode) => {
    setMode(next)
    setCursor(0)
    if (next === "files") loadFiles(path)
    if (next === "trash") loadTrash()
    if (next === "rewind") loadChanges()
    // Only on success. Setting "browsing" unconditionally overwrote the
    // "result" phase the loader had just set to show its error, so a provider
    // that threw left the tab silently empty with no way to find out why.
    if (next === "sync") {
      if (loadPairs()) setPhase("browsing")
    }
    if (next === "settings") {
      if (loadConfig()) {
        setCursor(firstEntry(settingsRows(config)))
        setPhase("browsing")
      }
    }
    if (next === "shares") {
      loadShares()
      setPhase("browsing")
    }
  }

  const loadTrash = () => {
    setPhase("loading")
    api
      .listTrash()
      .then((response) => {
        if (response.result === 1000) {
          setItems([])
          setCursor(0)
          showResult(
            "⚠ Trash requires a session token — not supported with OAuth access tokens.",
            true,
          )
          return
        }
        const raw: PCloudTrashItem[] = (response.contents ??
          []) as PCloudTrashItem[]
        setTrashItems(raw)
        const mapped: PCloudFolderItem[] = raw.map(trashItemToRow)
        setItems(mapped)
        setCursor(0)
        setPhase("browsing")
      })
      .catch((err) => {
        console.error(`Error: ${err instanceof Error ? err.message : err}`)
        process.exit(1)
      })
  }

  useEffect(() => {
    loadFiles(path)
  }, [path])

  useEffect(() => {
    loadShares()
  }, [])

  const enterSelected = () => {
    const selected = items[cursor]
    if (selected?.isfolder) {
      const next =
        path === "/" ? `/${selected.name}` : `${path}/${selected.name}`
      setPath(next)
    }
  }

  const goUp = () => {
    if (path !== "/") setPath(parentPath(path))
  }

  const openFile = (fileid: number) => {
    runAction(async () => {
      const res = await api.getFileLink(fileid)
      if (!res.hosts || !res.path)
        throw new Error(res.error ?? "Failed to get link")
      await open(`https://${res.hosts[0]}${res.path}`)
      showResult("\u2713 Opened")
    })
  }

  // Opening the download URL hands the file to the browser, which for an image
  // means a tab rather than an image viewer. Fetching a copy first and opening
  // that lets the OS route it to whatever actually edits or views the type —
  // Preview on macOS — and gives a real file to drag elsewhere.
  const openCopyLocally = (item: PCloudFolderItem) => {
    const fileid = item.fileid
    if (fileid === undefined) return
    runAction(async () => {
      const res = await api.getFileLink(fileid)
      if (!res.hosts || !res.path)
        throw new Error(res.error ?? "Failed to get link")
      const response = await fetch(`https://${res.hosts[0]}${res.path}`)
      if (!response.ok) throw new Error(`Download failed (${response.status})`)
      // basename, because a pCloud name is free text and a "/" in it would
      // otherwise write outside the temp directory.
      const local = nodePath.join(os.tmpdir(), nodePath.basename(item.name))
      fs.writeFileSync(local, Buffer.from(await response.arrayBuffer()))
      await open(local)
      showResult(`✓ Opened a copy of "${item.name}"`)
    })
  }

  const copyLink = (fileid: number) => {
    runAction(async () => {
      const res = await api.getFileLink(fileid)
      if (!res.hosts || !res.path)
        throw new Error(res.error ?? "Failed to get link")
      showResult(`https://${res.hosts[0]}${res.path}`)
    })
  }

  const deleteSelected = (item: PCloudFolderItem) => {
    const label = item.isfolder
      ? `Delete "${item.name}" and everything inside it?`
      : `Delete "${item.name}"?`
    if (item.isfolder && item.folderid !== undefined) {
      const id = item.folderid
      triggerConfirm(label, async () => {
        const res = await api.deleteFolder(id)
        if (res.result !== 0) throw new Error(res.error ?? "Delete failed")
        showResult(`\u2713 Deleted "${item.name}"`)
        loadFiles(path)
      })
      return
    }
    if (item.fileid !== undefined) {
      const id = item.fileid
      triggerConfirm(label, async () => {
        const res = await api.deleteFile(id)
        if (res.result !== 0) throw new Error(res.error ?? "Delete failed")
        showResult(`\u2713 Deleted "${item.name}"`)
        loadFiles(path)
      })
    }
  }

  const restoreTrashItem = (item: PCloudTrashItem & { folderid?: number }) => {
    runAction(async () => {
      const res =
        item.folderid !== undefined
          ? await api.restoreFolderFromTrash(item.folderid)
          : await api.restoreFromTrash(item.fileid)
      if (res.result !== 0) throw new Error(res.error ?? "Restore failed")
      showResult(`\u2713 Restored "${item.name}"`)
      loadTrash()
    })
  }

  // A single deleted file restores cleanly and a single edit reverts cleanly —
  // it is only undoing *part* of a bulk change that gets incoherent, and that
  // is what `pcloud rewind` is for. Per-row recovery here is well defined.
  const uploadInto = (local: string) => {
    setPhase("browsing")
    const target = currentFolderId
    if (target === undefined) {
      showResult(
        "Cannot tell which folder this is — reload and try again",
        true,
      )
      return
    }

    const source = local.trim().replace(/^~/, os.homedir())
    if (!source) return

    runAction(async () => {
      if (!fs.existsSync(source)) throw new Error(`No such file: ${source}`)
      if (fs.statSync(source).isDirectory())
        throw new Error(
          "That is a folder. pCloud's upload takes one file at a time.",
        )

      const name = nodePath.basename(source)
      const res = await api.uploadFile(target, name, fs.readFileSync(source))
      if (res.result !== 0) throw new Error(res.error ?? "Upload failed")
      showResult(`✓ Uploaded "${name}"`)
      loadFiles(path)
    })
  }

  const removeIgnore = (value: string, list: "patterns" | "paths") => {
    if (!settings) return
    triggerConfirm(`Stop ignoring "${value}"?`, async () => {
      const next: SettingsView =
        list === "patterns"
          ? {
              ...config,
              ignorePatterns: config.ignorePatterns.filter((p) => p !== value),
            }
          : {
              ...config,
              ignorePaths: config.ignorePaths.filter((p) => p !== value),
            }
      // The host throws when pCloud Drive is running, since it would flush its
      // own settings over the write on quit. Surfaced, not swallowed.
      settings.write(next)
      setConfig(next)
      showResult(`✓ No longer ignoring "${value}"`)
    })
  }

  const stopSharing = (share: PCloudShareItem) => {
    triggerConfirm(
      `Stop sharing "${share.foldername ?? share.folderid}" with ${share.tomail ?? "the recipient"}?`,
      async () => {
        // shareid, not sharerequestid — removeshare ends an accepted share,
        // and sending the wrong id fails with a message about the other one.
        const res = await api.removeShare(share.shareid)
        if (res.result !== 0)
          throw new Error(res.error ?? "Could not stop sharing")
        showResult(`✓ Stopped sharing "${share.foldername ?? share.folderid}"`)
        loadShares()
      },
    )
  }

  const runRecovery = (entry: PCloudDiffEntry, recovery: RewindRecovery) => {
    const label = entry.metadata?.name ?? "item"

    if (recovery.kind === "revert") {
      runAction(async () => {
        const revisions = await api.listRevisions(recovery.fileid)
        if (revisions.result !== 0)
          throw new Error(revisions.error ?? "Could not list revisions")
        // pCloud promises no order here, and reverting to whichever revision
        // happened to arrive first undoes far more than the last edit. The
        // highest revisionid is the one immediately behind the current file.
        const previous = (revisions.revisions ?? [])
          .slice()
          .sort((a, b) => b.revisionid - a.revisionid)[0]
        if (!previous) throw new Error("No earlier revision to revert to")
        const res = await api.revertRevision(
          recovery.fileid,
          previous.revisionid,
        )
        if (res.result !== 0) throw new Error(res.error ?? "Revert failed")
        showResult(
          `\u2713 Reverted "${label}" to revision ${previous.revisionid}`,
        )
      })
      return
    }

    runAction(async () => {
      const res =
        recovery.kind === "restoreFolder"
          ? await api.restoreFolderFromTrash(recovery.folderid)
          : await api.restoreFromTrash(recovery.fileid)
      if (res.result === 1000)
        throw new Error(
          "\u26a0 Trash requires a session token \u2014 not supported with OAuth access tokens.",
        )
      if (res.result !== 0) throw new Error(res.error ?? "Restore failed")
      showResult(`\u2713 Restored "${label}"`)
    })
  }

  // The bulk undo the Rewind tab was named after. Planning is a separate step
  // from applying so the confirmation can state how much is about to move —
  // "rewind" with no count is a blank cheque, and the CLI has always shown one.
  const rewindTo = (entry: PCloudDiffEntry) => {
    runAction(async () => {
      const since = new Date(entry.time)
      if (Number.isNaN(since.getTime()))
        throw new Error("That event has no usable timestamp")

      const plan = await planRewind(api, since)
      const restores = plan.actions.filter((a) => a.kind === "restore").length
      const reverts = plan.actions.filter((a) => a.kind === "revert").length
      const created = plan.actions.filter((a) => a.kind === "created").length

      if (restores + reverts === 0) {
        showResult("Nothing to undo — no deletions or edits since then.")
        return
      }

      // Creations are counted but never undone: the only way to reverse one is
      // to delete real data, which is indistinguishable from the accident a
      // rewind is meant to repair.
      const scope = [
        `restore ${restores}`,
        `revert ${reverts}`,
        created > 0 ? `leave ${created} creation(s) alone` : "",
      ]
        .filter(Boolean)
        .join(", ")

      triggerConfirm(
        `Rewind to ${since.toLocaleString()} — ${scope}?`,
        async () => {
          const outcomes = await applyRewind(api, plan)
          const failed = outcomes.filter((o) => !o.ok)
          showResult(
            failed.length === 0
              ? `✓ Rewound ${outcomes.length} change(s)`
              : `Rewound ${outcomes.length - failed.length}/${outcomes.length} — ${failed[0].detail}`,
            failed.length > 0,
          )
          loadChanges()
        },
      )
    })
  }

  // detail is shown under the highlighted row. A label short enough to scan is
  // rarely long enough to say what it touches, and the difference between one
  // file and the whole account is not a difference to leave to inference.
  type ItemAction = { label: string; detail?: string; run: () => void }

  // Actions are derived from the selection rather than fixed, so the modal never
  // offers something that would fail — no "open" on a trashed file whose parent
  // is gone, no "restore" on something that was never deleted.
  const actionsFor = (): ItemAction[] => {
    const selected = items[cursor]
    if (!selected && mode !== "rewind") return []

    if (mode === "trash") {
      const trashed = trashItems[cursor]
      if (!trashed) return []
      return [
        {
          label: `Restore "${selected.name}"`,
          detail: "Puts it back where it was before it was deleted.",
          run: () => restoreTrashItem(trashed),
        },
      ]
    }

    if (mode === "settings") {
      const row = settingsRows(config)[cursor]
      if (!isEntry(row) || !settings) return []
      return [
        {
          label: `Stop ignoring "${row.value}"`,
          detail:
            "pCloud will start syncing anything matching it. Takes effect " +
            "when pCloud Drive next starts.",
          run: () => removeIgnore(row.value, row.list),
        },
      ]
    }

    if (mode === "sync") return []

    if (mode === "shares") {
      const share = selectedShare
      if (!share) return []
      // Outgoing only: removeshare ends a share you granted. Leaving one you
      // were given is declineshare, on a sharerequestid you no longer have
      // once it has been accepted.
      if (cursor >= outgoing.length) return []
      return [
        {
          label: `Stop sharing "${share.foldername ?? share.folderid}"`,
          detail: `Revokes access for ${share.tomail ?? "the recipient"}. The folder itself is untouched.`,
          run: () => stopSharing(share),
        },
      ]
    }

    if (mode === "rewind") {
      const row = rewindRows[cursor]
      if (!row || row.kind === "day") return []

      // Recovery acts on the newest event in a run — reverting to the version
      // before the last save is what "undo that edit" means. A rewind starts
      // from the oldest, so choosing a run undoes the run rather than its final
      // moment. Expanding the run is how you reach anything in between.
      const entry = row.kind === "event" ? row.entry : row.run.last
      const rewindFrom = row.kind === "event" ? row.entry : row.run.first
      const name = entry.metadata?.name ?? "item"
      const recovery = recoveryFor(entry)

      const when = clockTime(rewindFrom.time)
      const expandable = row.kind === "run" && row.run.count > 1

      // Single-row recovery first: it is the narrower, safer thing, and putting
      // the bulk rewind under the cursor's default would make one keystroke
      // move hundreds of files.
      return [
        ...(expandable
          ? [
              {
                label: `Show the ${row.run.count} changes in this run`,
                detail:
                  "Lists each save on its own row, so you can act on one " +
                  "moment rather than the whole day. Same as the right arrow.",
                run: () =>
                  setExpandedRuns((open) => new Set(open).add(row.run.key)),
              },
            ]
          : []),
        ...(recovery
          ? [
              {
                label:
                  recovery.kind === "revert"
                    ? `Revert "${name}" to its previous version`
                    : `Restore "${name}"`,
                detail:
                  recovery.kind === "revert"
                    ? "This file only — undoes its most recent edit."
                    : "This item only — brings it back from the trash.",
                run: () => runRecovery(entry, recovery),
              },
            ]
          : []),
        {
          label: `Rewind the whole account to ${when}`,
          detail:
            "Undoes this change and every deletion or edit after it. " +
            "You will see the counts before anything moves.",
          run: () => rewindTo(rewindFrom),
        },
      ]
    }

    if (mode !== "files") return []

    const actions: ItemAction[] = []
    if (selected.isfolder) {
      actions.push({
        label: "Open folder",
        detail: "Descends into it — the same as the right arrow.",
        run: enterSelected,
      })
    } else if (selected.fileid !== undefined) {
      const id = selected.fileid
      actions.push({
        label: "Open a copy in the default app",
        detail: "Downloads it and hands it to the OS — Preview, for an image.",
        run: () => openCopyLocally(selected),
      })
      actions.push({
        label: "Open in browser",
        detail: "Opens the pCloud download link in your browser.",
        run: () => openFile(id),
      })
      actions.push({
        label: "Copy download link",
        detail: "Prints a temporary direct link you can paste elsewhere.",
        run: () => copyLink(id),
      })
    }
    actions.push({
      label: "Upload a file here",
      detail: `Puts a local file into ${path} — the folder you are already in.`,
      run: () => setPhase("uploading"),
    })
    actions.push({
      label: "Delete",
      detail: selected.isfolder
        ? "Moves this folder and everything inside it to the trash."
        : "Moves this file to the trash.",
      run: () => deleteSelected(selected),
    })
    return actions
  }

  const returnToFiles = () => {
    setMode("files")
    setTrashItems([])
    loadFiles(path)
  }

  const triggerConfirm = (label: string, action: () => Promise<void>) => {
    setConfirmAction(label)
    setPendingAction(() => action)
    setPhase("confirming")
  }

  useInput((input, key) => {
    if (phase === "uploading") {
      // Only escape: every other keystroke is the TextInput's, and stealing
      // them here would eat the path as it is typed.
      if (key.escape) setPhase("browsing")
      return
    }

    if (phase === "result") {
      setPhase("browsing")
      return
    }

    if (phase === "confirming") {
      if (input === "y" && pendingAction) {
        const action = pendingAction
        setPendingAction(null)
        runAction(action)
      } else if (input === "n") {
        setPendingAction(null)
        setPhase("browsing")
      }
      return
    }

    if (phase === "actions") {
      const actions = actionsFor()
      if (key.escape || input === "q") {
        setPhase("browsing")
        return
      }
      if (key.downArrow)
        setActionCursor((c) => Math.min(actions.length - 1, c + 1))
      if (key.upArrow) setActionCursor((c) => Math.max(0, c - 1))
      if (key.return) {
        const chosen = actions[actionCursor]
        setPhase("browsing")
        chosen?.run()
      }
      return
    }

    if (phase !== "browsing") return

    if (key.return) {
      // A dead key is indistinguishable from a broken one. Most Rewind rows
      // are creations, which have no inverse, so silence here read as the
      // action modal being broken rather than absent.
      if (actionsFor().length === 0) {
        showResult(
          mode === "rewind"
            ? "Nothing to undo here — only deletions and edits can be recovered."
            : "No actions for this selection.",
        )
        return
      }
      setActionCursor(0)
      setPhase("actions")
      return
    }

    if (input === "q") {
      onExit()
      return
    }

    if (key.tab) {
      const at = TABS.findIndex((t) => t.value === mode)
      // Adding length before the modulo keeps shift+tab from going negative on
      // the first tab, where -1 % 3 is -1 rather than the last index.
      const step = key.shift ? TABS.length - 1 : 1
      switchTo(TABS[(at + step) % TABS.length].value)
      return
    }

    if (mode === "sync") {
      if (key.downArrow) setCursor((c) => Math.min(pairs.length - 1, c + 1))
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1))
      if (input === "r") loadPairs()
      return
    }

    if (mode === "settings") {
      const rows = settingsRows(config)
      if (key.downArrow) setCursor((c) => nextEntry(rows, c, 1))
      if (key.upArrow) setCursor((c) => nextEntry(rows, c, -1))
      if (input === "r") loadConfig()
      return
    }

    if (mode === "shares") {
      const total = outgoing.length + incoming.length
      if (key.downArrow) setCursor((c) => Math.min(total - 1, c + 1))
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1))
      if (input === "r") loadShares()
      return
    }

    // Rewind lists day headings and folded runs rather than files, so the
    // cursor moves over rows — skipping the headings — and none of the file or
    // trash actions below apply to it.
    if (mode === "rewind") {
      if (key.downArrow) setCursor((c) => nextSelectable(rewindRows, c, 1))
      if (key.upArrow) setCursor((c) => nextSelectable(rewindRows, c, -1))
      if (input === "r") loadChanges()

      const row = rewindRows[cursor]
      if (row?.kind === "day" || row === undefined) return

      if (key.rightArrow && row.kind === "run" && row.run.count > 1)
        setExpandedRuns((open) => new Set(open).add(row.run.key))

      if (key.leftArrow) {
        const runKey = row.run.key
        setExpandedRuns((open) => {
          const next = new Set(open)
          next.delete(runKey)
          return next
        })
        // Collapsing from inside a run has to carry the cursor back out to the
        // run's own row, or every row below shifts up under a selection that
        // stayed where it was.
        if (row.kind === "event")
          setCursor(rewindRows.findIndex((r) => r.key === runKey))
      }
      return
    }

    if (key.downArrow) setCursor((c) => Math.min(items.length - 1, c + 1))
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1))

    if (mode === "files") {
      const selected = items[cursor]
      if (input === "u") {
        setPhase("uploading")
        return
      }
      if (input === "r") loadFiles(path)
      if (key.rightArrow) enterSelected()
      if (key.leftArrow) goUp()

      if (!selected) return

      if (input === "d") {
        // A folder delete is recursive, which the bare name does not convey —
        // and the count of what is about to go is not knowable from this view.
        const label = selected.isfolder
          ? `Delete "${selected.name}" and everything inside it?`
          : `Delete "${selected.name}"?`
        if (selected.isfolder && selected.folderid !== undefined) {
          const id = selected.folderid
          triggerConfirm(label, async () => {
            const res = await api.deleteFolder(id)
            if (res.result !== 0) throw new Error(res.error ?? "Delete failed")
            showResult(`\u2713 Deleted "${selected.name}"`)
            loadFiles(path)
          })
        } else if (!selected.isfolder && selected.fileid !== undefined) {
          const id = selected.fileid
          triggerConfirm(label, async () => {
            const res = await api.deleteFile(id)
            if (res.result !== 0) throw new Error(res.error ?? "Delete failed")
            showResult(`\u2713 Deleted "${selected.name}"`)
            loadFiles(path)
          })
        }
        return
      }

      if (
        input === "o" &&
        !selected.isfolder &&
        selected.fileid !== undefined
      ) {
        const id = selected.fileid
        runAction(async () => {
          const res = await api.getFileLink(id)
          if (!res.hosts || !res.path)
            throw new Error(res.error ?? "Failed to get link")
          await open(`https://${res.hosts[0]}${res.path}`)
          showResult(`✓ Opened in browser`)
        })
        return
      }

      if (
        input === "l" &&
        !selected.isfolder &&
        selected.fileid !== undefined
      ) {
        const id = selected.fileid
        runAction(async () => {
          const res = await api.getFileLink(id)
          if (!res.hosts || !res.path)
            throw new Error(res.error ?? "Failed to get link")
          showResult(`https://${res.hosts[0]}${res.path}`)
        })
        return
      }

      if (
        input === "p" &&
        !selected.isfolder &&
        selected.fileid !== undefined
      ) {
        const id = selected.fileid
        runAction(async () => {
          const res = await api.getFilePublink(id)
          if (res.result !== 0)
            throw new Error(res.error ?? "Failed to get public link")
          showResult(res.link)
        })
        return
      }
    }

    if (mode === "trash") {
      // Left used to mean "leave", back when trash was a sub-mode entered from
      // files. As a tab it is a peer, not a child — tab is how you leave — so
      // left has nothing to go up to and should stay put.
      if (key.escape) {
        switchTo("files")
        return
      }

      if (input === "r") {
        const trashItem = trashItems[cursor]
        if (!trashItem) return
        runAction(async () => {
          // Trash is mostly folders — a folder deletion is what fills it — and
          // those carry folderid, not fileid. Restoring by fileid alone worked
          // only on a loose file at the root, the rarer case by far.
          const item = trashItem as typeof trashItem & { folderid?: number }
          const res =
            item.folderid !== undefined
              ? await api.restoreFolderFromTrash(item.folderid)
              : await api.restoreFromTrash(item.fileid)
          if (res.result === 1000)
            throw new Error(
              "⚠ Trash requires a session token — not supported with OAuth access tokens.",
            )
          if (res.result !== 0) throw new Error(res.error ?? "Restore failed")
          showResult(`\u2713 Restored "${trashItem.name}"`)
          loadTrash()
        })
        return
      }
    }
  })

  const { rows: terminalRows = 24 } = useWindowSize()

  // Header, its margin and the footer come to 8 rows, which the list used to
  // claim in full — leaving nothing for an overlay, so Yoga composited the
  // action modal's label and hint onto the same row. Every overlay is a
  // sibling of the list, so the list has to give up its rows first.
  const CHROME_ROWS = 8
  // marginTop 1 + two border rows + one description slot + one hint row. The
  // description slot is always drawn, even empty, so this stays independent of
  // which option the cursor is on.
  const ACTION_MODAL_CHROME = 5
  const overlayRows =
    phase === "actions"
      ? actionsFor().length + ACTION_MODAL_CHROME
      : phase === "uploading"
        ? 6
        : phase === "confirming"
          ? 3
          : phase === "result"
            ? 2
            : 0
  // The "N more" markers above and below the window occupy rows of their own,
  // and the file list is the only view that draws them. Reserving both
  // unconditionally costs two lines on a list that already fits, which beats
  // the self-referential alternative where the window size depends on whether
  // the window overflows.
  // Only Files and Trash draw the "N more" markers around their window.
  const SCROLL_MARKER_ROWS = mode === "files" || mode === "trash" ? 2 : 0
  const visibleCount = Math.max(
    1,
    terminalRows - CHROME_ROWS - overlayRows - SCROLL_MARKER_ROWS,
  )
  const selectedRow = rewindRows[cursor]
  const selectedShare = [...outgoing, ...incoming][cursor]
  const windowStart = Math.min(
    Math.max(0, cursor - Math.floor(visibleCount / 2)),
    Math.max(0, items.length - visibleCount),
  )
  const windowEnd = Math.min(windowStart + visibleCount, items.length)
  const visibleItems = items.slice(windowStart, windowEnd)
  const aboveCount = windowStart
  const belowCount = items.length - windowEnd

  const busy = phase === "loading" || phase === "executing"

  // Claiming the full terminal height is what pins the footer to the bottom:
  // without an explicit height the column shrinks to its content, so the hints
  // float directly under the last row rather than sitting at the screen edge.
  return (
    <Box flexDirection="column" height={terminalRows}>
      <Header path={path} mode={mode} tabs={TABS} />
      <Box flexDirection="row" flexGrow={1} marginTop={1}>
        <Box flexDirection="column" flexGrow={1}>
          {/* Only the content waits. Replacing the whole screen with a spinner
              tore down the tabs and footer on every switch, so the chrome
              flickered away and back for something that is usually instant. */}
          {busy ? (
            <Box paddingX={1}>
              <Spinner
                label={
                  phase === "executing" ? "Executing\u2026" : "Loading\u2026"
                }
              />
            </Box>
          ) : mode === "sync" ? (
            <Box paddingX={1} flexDirection="column">
              <SyncList pairs={pairs} selected={cursor} rows={visibleCount} />
              {pairsReadAt && (
                <Box marginTop={1}>
                  <Text color="gray">
                    {`read at ${pairsReadAt.toLocaleTimeString(undefined, { hour12: false })}`}
                  </Text>
                </Box>
              )}
              {pairs.some((p) => p.issues.length > 0) && (
                <Box marginTop={1} flexDirection="column">
                  {pairs
                    .filter((p) => p.issues.length > 0)
                    .map((p) => (
                      <Box key={p.id} flexDirection="column">
                        <Text color="red">{`#${p.id}  ${p.local}`}</Text>
                        {p.issues.map((issue) => (
                          <Text key={issue} dimColor color="white">
                            {`   ${issue}`}
                          </Text>
                        ))}
                      </Box>
                    ))}
                </Box>
              )}
            </Box>
          ) : mode === "settings" ? (
            <Box paddingX={1} flexDirection="column">
              <SettingsPanel
                settings={config}
                selected={cursor}
                rows={visibleCount}
              />
            </Box>
          ) : mode === "shares" ? (
            <Box paddingX={1} flexDirection="column">
              {outgoing.length > 0 && (
                <>
                  <Text bold color="white">
                    Shared with others
                  </Text>
                  <ShareList
                    shares={outgoing}
                    direction="outgoing"
                    selected={cursor}
                    rows={outgoing.length}
                  />
                </>
              )}
              {incoming.length > 0 && (
                <Box flexDirection="column" marginTop={outgoing.length ? 1 : 0}>
                  <Text bold color="white">
                    Shared with you
                  </Text>
                  <ShareList
                    shares={incoming}
                    direction="incoming"
                    selected={cursor - outgoing.length}
                    rows={incoming.length}
                  />
                </Box>
              )}
              {outgoing.length === 0 && incoming.length === 0 && (
                <Text dimColor color="white">
                  Nothing shared
                </Text>
              )}
            </Box>
          ) : mode === "rewind" ? (
            <Box paddingX={1}>
              <ChangesList
                entries={changes}
                selected={cursor}
                rows={visibleCount}
                emptyText="No recent changes"
                expanded={expandedRuns}
                paths={changePaths}
                now={now}
              />
            </Box>
          ) : items.length === 0 ? (
            <Box justifyContent="center">
              <Text dimColor color="white">
                {"  Empty"}
              </Text>
            </Box>
          ) : (
            <>
              {aboveCount > 0 && (
                <Box paddingX={2}>
                  {/* Template literal, not bare JSX text: JSX text is not a string
                      literal, so a written-out escape renders as its own
                      six characters instead of the arrow. */}
                  <Text color="yellow" dimColor>
                    {`\u2191 ${aboveCount} more`}
                  </Text>
                </Box>
              )}
              {visibleItems.map((item, i) => (
                <ItemRow
                  key={`${item.name}-${windowStart + i}`}
                  item={item}
                  selected={windowStart + i === cursor}
                  shared={
                    item.folderid === undefined
                      ? undefined
                      : sharedFolders.get(item.folderid)
                  }
                />
              ))}
              {belowCount > 0 && (
                <Box paddingX={2}>
                  <Text color="yellow" dimColor>
                    {`\u2193 ${belowCount} more`}
                  </Text>
                </Box>
              )}
            </>
          )}
        </Box>
        {/* Sync and Settings get the full width. Their rows are wide and
            there is nothing a side panel would add that the row does not
            already say — where Files, Rewind and Shares each have detail worth
            a second column. */}
        {mode === "sync" || mode === "settings" ? null : mode === "shares" ? (
          <SharePreview
            share={selectedShare}
            direction={cursor < outgoing.length ? "outgoing" : "incoming"}
          />
        ) : mode === "rewind" ? (
          <RunPreview
            run={selectedRow?.kind === "day" ? undefined : selectedRow?.run}
            entry={
              selectedRow?.kind === "event" ? selectedRow.entry : undefined
            }
            path={
              selectedRow && selectedRow.kind !== "day"
                ? changePaths.get(selectedRow.run.last.diffid)
                : undefined
            }
            now={now}
          />
        ) : (
          <Preview
            item={items[cursor]}
            imageUrl={
              previewImageItem === items[cursor]?.name
                ? (previewImageUrl ?? undefined)
                : undefined
            }
            markdownLines={
              previewMarkdownItem === items[cursor]?.name
                ? (previewMarkdownLines ?? undefined)
                : undefined
            }
          />
        )}
      </Box>
      {phase === "confirming" && (
        <Box marginTop={1} paddingX={1} flexDirection="column">
          <Box>
            <Text color="yellow" bold>
              {`  \u26A0  ${confirmAction}  `}
            </Text>
          </Box>
          <Box>
            <Box marginRight={2}>
              <Text backgroundColor="green" color="white" bold>{` y `}</Text>
              <Text color="white" dimColor>{` confirm`}</Text>
            </Box>
            <Box>
              <Text backgroundColor="red" color="white" bold>{` n `}</Text>
              <Text color="white" dimColor>{` cancel`}</Text>
            </Box>
          </Box>
        </Box>
      )}
      {phase === "actions" && (
        <Box
          marginTop={1}
          marginX={1}
          paddingX={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
        >
          {/* The whole list first, then one description slot for whatever is
              under the cursor. Interleaving the description after its own row
              moved every option below it as the cursor travelled, and made the
              modal's height depend on the selection — so the rows reserved for
              it were right for one option and short for the next. A fixed slot
              is both steadier to read and a constant to budget for.

              Truncate rather than wrap for the same reason: a line that
              silently becomes two puts that constant out by one. */}
          {actionsFor().map((action, i) => (
            <Text
              key={action.label}
              bold={i === actionCursor}
              color={i === actionCursor ? "cyan" : undefined}
              wrap="truncate-end"
            >
              {/* The marker, not the colour, says which row is selected. */}
              {`${i === actionCursor ? "❯" : " "} ${action.label}`}
            </Text>
          ))}
          <Text dimColor wrap="truncate-end">
            {`  ${actionsFor()[actionCursor]?.detail ?? ""}`}
          </Text>
          <Text color="gray">{"  ↑↓ choose · enter run · esc cancel"}</Text>
        </Box>
      )}
      {phase === "uploading" && (
        <Box
          marginTop={1}
          marginX={1}
          paddingX={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
        >
          <Text bold color="cyan">{`Upload into ${path}`}</Text>
          <Box>
            <Text color="gray">{"  "}</Text>
            <TextInput
              placeholder="~/path/to/file"
              onSubmit={(value) => uploadInto(value)}
            />
          </Box>
          <Text color="gray">{"  enter upload · esc cancel"}</Text>
        </Box>
      )}
      {phase === "result" && (
        <Box marginTop={1} paddingX={1}>
          <Text color={resultIsError ? "red" : "green"} bold>
            {resultMessage}
          </Text>
          <Text color="white" dimColor>
            {"  (any key to dismiss)"}
          </Text>
        </Box>
      )}
      <Footer
        count={
          mode === "rewind"
            ? changes.length
            : mode === "shares"
              ? outgoing.length + incoming.length
              : mode === "sync"
                ? pairs.length
                : mode === "settings"
                  ? config.ignorePatterns.length + config.ignorePaths.length
                  : items.length
        }
        mode={mode}
      />
    </Box>
  )
}

// Wrapping is part of the contract, not a detail: the image preview needs the
// terminal-info context, so a host that mounted <PCloudBody> bare would render
// without previews and have no obvious reason why.
export const PCloudBrowser = (props: PCloudBodyProps) => (
  <TerminalInfoProvider>
    <PCloudBody {...props} />
  </TerminalInfoProvider>
)
