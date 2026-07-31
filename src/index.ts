// @kud/pcloud-ink — controlled Ink components for rendering pCloud domain
// objects. Every component is presentation-only: props in, no data fetching, no
// app-level input. The consuming surface owns selection, navigation and loading,
// so these compose into a full-screen CLI or a single pane in a larger dashboard
// alike. Built on @kud/ink-ui primitives; fed by @kud/pcloud types +
// formatters.
export {
  ChangesList,
  type ChangesListProps,
} from "./components/changes-list.js"
export {
  FileList,
  sortItems,
  type FileListProps,
} from "./components/file-list.js"
export {
  AccountPanel,
  type AccountPanelProps,
} from "./components/account-panel.js"
// The assembled interactive browser. Embeddable: it does not own the terminal
// or call render(), reporting quit through the required onExit callback, so a
// host — the CLI, a cockpit pane — mounts it as one component and keeps the
// terminal lifecycle to itself.
export {
  PCloudBody,
  PCloudBrowser,
  type PCloudBodyProps,
} from "./pcloud-body.js"
export { eventTone, isFolderEvent, type EventTone } from "./lib/event.js"
export { windowSlice } from "./lib/window.js"
export { Panel } from "@kud/ink-ui"
export {
  buildRuns,
  buildRows,
  dayLabel,
  relativeAge,
  clockTime,
  sparkline,
  nextSelectable,
  firstSelectable,
  type EventRun,
  type RewindRow,
} from "./lib/rewind-rows.js"
export {
  ShareList,
  shareRights,
  type ShareListProps,
} from "./components/share-list.js"
export {
  TrashList,
  trashId,
  deletedOn,
  type TrashListProps,
} from "./components/trash-list.js"
export {
  PublinkList,
  publinkExpiry,
  type PublinkListProps,
} from "./components/publink-list.js"
export {
  RevisionList,
  byNewest,
  type RevisionListProps,
} from "./components/revision-list.js"
