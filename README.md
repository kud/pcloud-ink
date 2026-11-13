<div align="center">

<img src="assets/icon.svg" width="128" alt="pCloud Ink icon" />

☁️

# pCloud Ink

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![npm](https://img.shields.io/npm/v/%40kud%2Fpcloud-ink?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**☁️ Ink components for rendering pCloud domain objects — file lists, change history, account panels**

<a href="https://kud.io/projects/pcloud-ink">Website</a> · <a href="https://kud.io/projects/pcloud-ink/docs">Documentation</a>

</div>

## Features

The presentation layer of the pCloud toolchain: [`@kud/pcloud`](https://github.com/kud/pcloud) provides the types, formatters and rewind engine, this package renders them — file listings, change history, shares, sync health, and the assembled browser — and [`@kud/pcloud-cli`](https://github.com/kud/pcloud-cli) consumes them.

- **Presentation-only lists** — files, changes, shares, trash, public links, revisions and sync health; props in, no fetching, no input handling
- **Controlled selection** — pass `selected` and `rows`, own the key handling yourself
- **Assembled browser** — `PCloudBrowser` mounts the lists into six tabs as a full interactive client
- **Host-provided extras** — the **Sync** and **Settings** tabs appear only when the host supplies a provider
- **Never colour alone** — glyphs, labels and positional `rwcd` carry every state

## Install

```sh
npm install @kud/pcloud-ink
```

`ink` (>=7) and `react` (>=19) are peer dependencies.

## Usage

Every list component is presentation-only — props in, no data fetching, no input
handling. The consuming surface owns selection, navigation and loading, so the
same component composes into a one-shot CLI command or a pane in a larger
dashboard.

```tsx
import { render } from "ink";
import { FileList, sortItems } from "@kud/pcloud-ink";

const { unmount } = render(
  <FileList items={sortItems(contents)} rows={contents.length} />,
);
unmount();
```

## Components

| Component       | Renders                                         |
| --------------- | ----------------------------------------------- |
| `FileList`      | Folder contents — kind, name, size, modified    |
| `ChangesList`   | Change events, folded into one row per file/day |
| `ShareList`     | Folder shares, in either direction              |
| `TrashList`     | Deleted items, with the id that restores each   |
| `PublinkList`   | Public links, with downloads and expiry         |
| `RevisionList`  | A file's revisions, newest first                |
| `SyncList`      | Local sync pair health                          |
| `SettingsPanel` | Client ignore rules                             |
| `AccountPanel`  | Email, plan and storage use with a progress bar |

Each takes `rows` (the visible window height) and an optional `selected` index.
Lists are controlled: pass `selected` and own the key handling yourself.

## The assembled browser

`PCloudBrowser` is the exception — a full interactive client, not a
presentation-only component. It mounts the lists above into six tabs and owns
its own navigation.

```tsx
import { render } from "ink";
import { PCloudBrowser } from "@kud/pcloud-ink";

render(<PCloudBrowser onExit={() => process.exit(0)} api={client} />, {
  alternateScreen: true,
});
```

| Prop       | Purpose                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `onExit`   | Required. The host owns the terminal lifecycle, so quitting is yours      |
| `api`      | An authenticated client. Omit and the stored credential is used           |
| `sync`     | Reads local sync pairs. Omit and the **Sync** tab is absent               |
| `settings` | Reads and writes client settings. Omit and the **Settings** tab is absent |

`sync` and `settings` are providers rather than built-in because they read a
SQLite database on the host machine, not the pCloud API. A rendering package has
no business opening that file, and a consumer with no local pCloud install
should not be offered a tab that could only ever be empty.

## Helpers

- `sortItems` — folders first, then files, each alphabetically
- `windowSlice` — the visible slice that keeps `selected` in view
- `fit` — pad **and** truncate to an exact width, always leaving a gutter
- `eventTone` — maps a change event to its glyph, label and colour
- `buildRuns` / `buildRows` — fold change events into runs and day headings
- `byNewest` — order revisions by id, since the API promises no order
- `shareRights` — the four permission booleans as positional `rwcd`

## Accessibility

State is never carried by colour alone.

Change events are distinguished by glyph and label (`+ created`, `~ modified`,
`- deleted`) with colour as reinforcement only. Directories are marked with a
trailing slash. Share permissions render positionally as `rwcd`, so `rw--` and
`r--d` are distinguishable at a glance where "read, modify" and "read, delete"
are not. Sync health leads with `✓` or `✗` before any colour is applied.

Every fixed-width column goes through `fit`, which truncates as well as pads —
a value that exactly fills its column would otherwise weld itself to the next
one, and `padEnd` alone never shortens anything.

## Development

```sh
git clone https://github.com/kud/pcloud-ink.git
cd pcloud-ink
npm install
npm run dev
```

| Script              | Purpose                        |
| ------------------- | ------------------------------ |
| `npm run build`     | Bundle to `dist/` with tsup    |
| `npm run dev`       | Rebuild on change              |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test`          | Run the vitest suite           |

## Licence

MIT © kud

📚 **Full documentation → [pcloud-ink/docs](https://kud.io/projects/pcloud-ink/docs)**
