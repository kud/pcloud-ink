// pCloud Drive keeps its sync pairs and client settings in a SQLite database on
// this machine, not in the account — so the browser cannot fetch them the way it
// fetches everything else. Rather than give a rendering package a node:sqlite
// dependency, the host supplies them.
//
// Both are optional, and a host that omits one simply does not get that tab. A
// web or remote consumer has no local database to read and should not be shown
// a view that would only ever be empty.

export type SyncPairView = {
  id: number
  /** Local folder, already shortened for display by the host. */
  local: string
  /** Remote folder, or undefined when the pair points at nothing. */
  remote?: string
  files: number
  queued: number
  /** Human-readable problems. Empty means healthy. */
  issues: string[]
}

export type SettingsView = {
  ignorePatterns: string[]
  ignorePaths: string[]
}

export type SyncProvider = () => SyncPairView[]

export type SettingsProvider = {
  read: () => SettingsView
  /**
   * Persist a change. Expected to throw when it cannot — pCloud Drive rewrites
   * its settings from memory on quit, so a write made while it runs is undone
   * silently, and the host refusing is the only honest outcome.
   */
  write: (next: SettingsView) => void
}

export const pairIsHealthy = (pair: SyncPairView): boolean =>
  pair.issues.length === 0

// The glyph says the state and the issue text says why. Colour only reinforces,
// so a pair in trouble is still identifiable without it.
export const pairGlyph = (pair: SyncPairView): string =>
  pairIsHealthy(pair) ? "✓" : "✗"
