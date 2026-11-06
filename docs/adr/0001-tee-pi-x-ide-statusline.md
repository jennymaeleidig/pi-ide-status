# 0001 — Tee `pi-x-ide`'s statusline text rather than observing the IDE ourselves

**Status**: Accepted — 2026-11-06

## Context

`pi-ide-status` must display the file and line range the IDE has attached to the prompt, in
Zentui's Minimalist border, and show nothing when no IDE is connected.

`pi-x-ide` holds this in RAM. `PiIdeRuntime.connectionStatus` and `PiIdeRuntime.latestSelection`
(`src/pi/state.ts`) are mutated by plain assignment: there is no emitter, no subscriber, no
callback fan-out, and the repository contains no `pi.events` emission at all. pi 1.5 discards an
extension factory's return value and loads every package with `moduleCache: false`, so importing
the installed package yields a private copy of the module rather than the live runtime.

What `pi-x-ide` does publish, when its `status_display` configuration is `statusline`, is a
one-line string built by `buildConnectedSegments` (`src/pi/ui.ts:298`): `⧉ ✓ <basename>#L12-L15`
for a range, `⧉ ✓ <basename>` for a file with no range, `⧉ ✓` for a connection with no
selection, `⧉ ⠋` while connecting, `⧉ ✕` on error, and `undefined` when disconnected or
disabled. VS Code broadcasts selection changes (`onDidChangeTextEditorSelection`,
`onDidChangeActiveTextEditor`, `onDidChangeTabs`) to `pi-x-ide`, whose `onSelectionChanged`
calls `updateIdeUi`, so the string tracks the cursor live.

## Decision

Install a tee over `ctx.ui.setStatus` on the `ui` object pi hands to every extension in one
bind, forward every call unchanged, and mirror the calls keyed `pi-x-ide` onto Zentui's
custom-variable bus under the publisher key `pi-ide-status:ide`.

The mirrored text is verbatim apart from stripping SGR escapes, control characters and lone
surrogates, fitting to the protocol limit at a grapheme boundary, and dropping consecutive
duplicates. A predecessor failure under this package's own `pi-x-ide` key is contained — no throw
escapes and nothing is mirrored — while any other key's failure is forwarded unchanged.

## Consequences

- The chip cannot drift from `pi-x-ide`'s own wording, because it is that wording. Reformatting
  upstream's text is never our problem.
- The rendered value is `basename`, not a relative path: `index.ts#L12`, never
  `src/core/index.ts#L12`. The full path is not present in the statusline text, so the
  workaround would be a different data source, not a different formatter.
- The package depends on the user running `pi-x-ide` with `status_display: "statusline"`. With
  the default `widget`, `setStatus` is never called and the chip can never appear, so the
  package reads `pi-x-ide`'s configuration and warns once per session when it proves that
  cause.
- The package depends on an internal pi API shape: one `ui` object per bind, with `setStatus` as
  a data property (`interactive-mode.js:1562` calls `createExtensionUIContext()` once and passes
  the result to `session.bindExtensions`). A pi release that changes this breaks the tee
  silently, and the mitigation is a test over the tee plus a re-install on every publish.
- Load order becomes part of the contract: the tee must be installed after `pi-zentui`, so
  Zentui's own status controller finds itself no longer the owner, marks itself inactive and
  passes through.

## Alternatives considered

**Read the lock file and reimplement discovery.** `pi-x-ide` writes
`~/.pi/pi-x-ide/lock/<ide>-<pid>-<port>.lock` in a specified format
(`docs/specs/ide-protocol.md`), so a third party can determine that an IDE is _present_. It
cannot determine that `pi-x-ide` is _connected_ — the two diverge on `/ide off`, on exhausted
reconnects, on handshake error, and on Zed, which reports connected with no lock file at all —
and the lock carries nothing about the open file or selection. Presence is not the feature.

**Open our own WebSocket client.** The lock file carries `host`, `port` and `authToken`, and an
`initialize` request answers with a `selection_changed` snapshot plus pushes. This gives
structured selection data and needs no `status_display` configuration. It also risks
`IdeWebSocketServer.sendToFirstClient`, which is how VS Code's "Fix it" diagnostics reach
`pi-x-ide`: a client that connects first steals them, silently breaking a feature the user never
asked us to touch.

**Read the extension status map.** `ReadonlyFooterDataProvider.getExtensionStatuses()` is
reachable only inside a `setFooter` factory, and `setFooter` replaces the footer this package is
trying to augment. It also returns nothing in the default `widget` display mode.

**Ask upstream for an event.** `pi.events.emit("pi-x-ide:status", …)` on each transition is the
durable fix and is filed as a separate issue. It is not available today, and waiting for it
would gate the feature on someone else's release cadence. The mirror is one function, so the
swap is cheap when it lands.
