# pi-ide-status

A presentation-only bridge between `pi-x-ide` and Zentui: it mirrors the file and line range
the IDE has attached to the prompt into Zentui's Minimalist border, next to the Vim mode chip,
and shows nothing when no IDE is connected.

## Language

**Bridge**: An extension loaded between two others that translates between their published
interfaces without owning either. It imports neither package and upgrades independently of
both. _Avoid_: Shim, adapter, glue, plugin, wrapper

**Chip**: The label as rendered in one Zentui border slot; the user-visible result of the
package. _Avoid_: Badge, tag, indicator, widget

**Statusline text**: The single-line string `pi-x-ide` hands to `ctx.ui.setStatus` when its
`status_display` configuration is `statusline`. This package's only input. It is colorized
with SGR escapes and begins with the `⧉` glyph, a state marker, a basename, and a line span.
_Avoid_: Message, output, label, status

**Tee**: The data property this package installs over `ctx.ui.setStatus` on the `ui` object pi
hands to every extension in one bind. It forwards every call unchanged and copies the ones keyed
`pi-x-ide` to its own consumer. _Avoid_: Wrapper, hook, patch, interceptor, monkey-patch

**Mirror**: To republish a teed statusline text on the Zentui channel under this package's
publisher key, stripped of SGR, fitted, and deduplicated. _Avoid_: Forward, copy, relay, sync

**Publisher key**: The fixed key `pi-ide-status:ide` under which every value is published. It
is stable across releases. _Avoid_: Variable name, id, status key

**Alias**: The local name a Zentui configuration gives the publisher key with `variables`, so a
slot can reference it as `$ide`. _Avoid_: Publisher key, variable key, slot name

**Slot**: One of the six configurable Minimalist border positions whose template renders the
chip. This package never chooses one. _Avoid_: Segment, position, corner

**Zentui channel**: Zentui's custom-variable bus: a capability probe on
`zentui:variable-capability` and values on `zentui:variable`. An empty or `undefined` value
removes the chip. This package's only output. _Avoid_: Event bus, Zentui API

**Active**: Zentui's per-key report that it owns an enabled surface currently demanding the
publisher key. It is not a guarantee that the chip is visible at the current width. _Avoid_:
Enabled, visible, owned, available

**Fitted value**: A statusline text cut at a grapheme boundary to at most 256 UTF-16 code units
and marked with an ellipsis, so the protocol never silently ignores an update. Only a value past
the protocol limit is ever fitted, so the chip differs from upstream's own text in that case
alone. _Avoid_: Label, truncated, clipped, shortened

**Tee ownership**: The condition that this package's tee is the own `setStatus` property of the
current `ui` object. Every publish checks it and re-installs the tee when a later tee has
displaced it. _Avoid_: Wrapper, registration, installation, control

**Rebind**: pi building a fresh `ui` object and calling every extension's `session_start` again —
on `/reload`, a new session, or a session switch. The tee does not survive a rebind and must be
re-installed. _Avoid_: Reload, restart, reinitialise

**Load order**: The position of a package in pi's `packages` array. This package must load after
`pi-zentui`, so Zentui's own status controller is already installed and becomes inert beneath
the tee. _Avoid_: Priority, precedence
