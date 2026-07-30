# @kud/pcloud-ink

☁️ Ink components for rendering pCloud domain objects — file listings, change history and account panels.

The presentation layer of the pCloud toolchain: [`@kud/pcloud-sdk`](https://github.com/kud/pcloud-sdk) provides the types and formatters, this package renders them, and [`@kud/pcloud-cli`](https://github.com/kud/pcloud-cli) consumes them.

## Install

```sh
npm install @kud/pcloud-ink
```

`ink` (>=7) and `react` (>=19) are peer dependencies.

## Usage

Every component is presentation-only — props in, no data fetching, no input handling. The consuming surface owns selection, navigation and loading, so the same component composes into a one-shot CLI command or a pane in a larger dashboard.

```tsx
import { render } from "ink"
import { FileList, sortItems } from "@kud/pcloud-ink"

const { unmount } = render(
  <FileList items={sortItems(contents)} rows={contents.length} />,
)
unmount()
```

## Components

| Component      | Renders                                         |
| -------------- | ----------------------------------------------- |
| `FileList`     | Folder contents — kind, name, size, modified    |
| `ChangesList`  | Account change events from `diff()`             |
| `AccountPanel` | Email, plan and storage use with a progress bar |

Each takes `rows` (the visible window height) and an optional `selected` index. Lists are controlled: pass `selected` and own the key handling yourself.

## Helpers

- `sortItems` — folders first, then files, each alphabetically
- `windowSlice` — the visible slice that keeps `selected` in view
- `eventTone` — maps a diff event to its glyph, label and colour

## Accessibility

State is never carried by colour alone. Diff events are distinguished by glyph and label (`+ created`, `~ modified`, `- deleted`) with colour as reinforcement only, and directories are marked with a trailing slash as well as a kind column — so every distinction survives in greyscale.

## Licence

MIT © kud
