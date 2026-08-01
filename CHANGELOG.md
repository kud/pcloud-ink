# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-01

### Changed

- **Going up a folder returns to the folder you came out of**, rather than the
  top of the list. The reason for going up is usually to step sideways into a
  neighbour, and landing back at the first row meant scrolling to find where you
  had just been.
  - Remembered by name, not index: the listing can change between the two
    renders, and an index would then point confidently at the wrong row where a
    name either matches or falls back to the top.

[1.1.0]: https://github.com/kud/pcloud-ink/compare/v1.0.0...v1.1.0

## [1.0.0] - 2026-08-01

The component set is complete and the browser it assembles is covered by tests.
That is what the major version marks — not new features, but the point at which
the API is one I am willing to keep.

### Added

- **`PCloudBrowser` takes an `api` prop.** It reached for a stored credential
  and called `process.exit` from inside a render, which no test survives and no
  consumer recovers from. It now accepts an authenticated client, falling back
  to the stored one so the CLI still mounts it bare.
- Eleven tests covering the browser shell itself — which tabs exist for which
  providers, what the file list renders, and that a provider throwing surfaces
  its error rather than tearing down the interface.

### Fixed

- **A sync or settings provider that threw left its tab silently empty.**
  `switchTo` set the phase to `browsing` _after_ the loader had set it to
  `result` to show the error, so the message was written and immediately
  discarded. Found by the new tests.
- **Directories in the browser were marked only by a nerd-font icon**, which is
  a blank box in any terminal without the font — leaving directory-ness carried
  by colour alone. They now carry a trailing slash, matching `FileList` and
  `pcloud ls`.

## [0.13.0] - 2026-08-01

Everything before this was released without a changelog. The history is in the
git log; the summary is that this package grew from three components to nine
plus an assembled browser over the course of a day.

### Added

- `ShareList`, `TrashList`, `PublinkList`, `RevisionList`, `SyncList` and
  `SettingsPanel`, so every listing the CLI prints goes through a component
  rather than hand-padded strings.
- `PCloudBrowser` gained Shares, Sync and Settings tabs, upload into the current
  folder, and a bulk rewind backed by `planRewind`.
- `fit`, which pads **and** truncates. `padEnd` never shortens, so any value
  longer than its column ran into the next one.

### Fixed

- Rewind folds a day's events on one file into a single run rather than
  repeating the same filename forty times.
- Revisions are ordered by id rather than trusting the API's arrival order.
- Image previews are no longer squashed: passing both a width and a height made
  the renderer discard the aspect ratio entirely.
- The action modal reserved rows for itself but not for the scroll markers
  around the file list, so its options were composited on top of each other.

[1.0.0]: https://github.com/kud/pcloud-ink/compare/v0.13.0...v1.0.0
[0.13.0]: https://github.com/kud/pcloud-ink/releases/tag/v0.13.0
