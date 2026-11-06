## Problem Statement

I run pi inside Zentui's Minimalist editor style, with the footer hidden. Minimalist draws one
border line and puts my Vim mode in it. `pi-x-ide` cannot use that line: its status goes to an
above-editor widget by default, which floats outside Zentui's frame as a stray row, or to the
footer statusline, which my configuration does not render.

So I cannot see, while I am typing a prompt, which file and line range in VS Code is actually
attached to that prompt. I have to look away from the terminal, or send the prompt and hope.
Turning on the widget costs me a row outside the frame; turning on `statusline` draws into a
surface that is hidden.

## Solution

A small presentation-only extension that mirrors `pi-x-ide`'s own statusline text into a Zentui
border slot, next to the Vim mode chip. When VS Code has a file open for me, the border shows
that file and its line range; when a selection is queued for the next prompt it shows the queue
marker; while the IDE is connecting it shows upstream's spinner; when the IDE is not connected
it shows nothing at all, and neither the slot nor the frame changes shape.

It never draws rows, owns no border, replaces no editor, opens no socket, polls no directory and
starts no timer. It writes one value to one slot and clears it again.

## User Stories

1. As a pi user with Zentui Minimalist and VS Code, I want the file currently open in VS Code
   shown in the editor border, so that I know what the IDE has attached without leaving the
   terminal.
2. As a pi user, I want the selected line range shown alongside the file, so that I can confirm
   the exact span that will enter my prompt.
3. As a pi user, I want the chip to sit next to my Vim mode chip, so that the border reads as
   one status line instead of two unrelated indicators.
4. As a pi user, I want the chip to update as I move the cursor in VS Code, so that it describes
   the present state rather than the state of my last prompt.
5. As a pi user, I want the chip to appear when I focus another file in VS Code, so that I do
   not have to send a prompt to refresh it.
6. As a pi user, I want the chip to show only the basename, so that a long workspace path never
   pushes my Vim mode off the border.
7. As a pi user, I want the chip to disappear when no IDE is connected, so that an empty slot
   does not become a permanent piece of furniture.
8. As a pi user, I want the chip to disappear when I close the IDE, so that it never claims a
   file that is no longer attached.
9. As a pi user, I want the chip to disappear when I run `/ide off`, so that it never
   contradicts my own decision to disable the integration.
10. As a pi user, I want upstream's pending-selection marker kept, so that I can tell a
    selection already attached to the prompt from one queued for the next.
11. As a pi user, I want upstream's connecting state visible, so that a slow handshake looks
    like progress rather than a broken package.
12. As a pi user, I want upstream's error state visible, so that a failed handshake is a signal
    instead of silence.
13. As a pi user, I want the chip to look identical to what upstream would have drawn, so that
    the two extensions never disagree about wording.
14. As a pi user, I want no colour of my own invented by this package, so that the chip inherits
    the theme instead of fighting it.
15. As a pi user, I want no chip rather than a corrupted chip when terminal widths shrink, so
    that the border never wraps or tears.
16. As a pi user, I want the chip to survive `/reload`, so that a reload does not silently
    retire the package.
17. As a pi user, I want the chip to survive a new or switched session, so that rebinding is
    not a hidden failure mode.
18. As a pi user reading the transcript later, I want the package to leave no statuses behind in
    the footer, so that Zentui's own status handling stays the only one on that surface.
19. As a pi user who configured `status_display: "widget"` by mistake, I want one warning per
    session naming the setting and the subcommand that changes it, so that an absent chip is
    diagnosable.
20. As a pi user with no IDE installed at all, I want silence, so that a missing companion is
    not treated as an error.
21. As a pi user who edits my Zentui configuration, I want the alias documented, so that I can
    move the chip to another slot without reading source.
22. As a pi user with several running IDE windows, I want the chip to describe the window
    `pi-x-ide` actually connected to, so that it never reports a neighbouring workspace.
23. As a pi user running a non-TUI session, I want the package to do nothing at all, so that
    headless runs are unaffected.
24. As a pi user whose terminal is narrow, I want the Vim chip to keep its place, so that adding
    this package cannot displace what was already there.
25. As a package author, I want the mirrored text to be upstream's verbatim, so that an upstream
    wording change is a non-event.
26. As a package author, I want every failure inside the tee contained, so that a bug in this
    package can never prevent `pi-x-ide`'s own status from being written.
27. As a package author, I want the tee restorable from a test, so that a bug cannot leave the
    `ui` object every extension shares permanently wrapped.
28. As a package author, I want the one architectural bet recorded in an ADR, so that the next
    session does not relitigate it.
29. As a package author, I want the vocabulary pinned in a glossary, so that "chip", "tee" and
    "mirror" mean one thing in every issue and commit.
30. As a package author, I want the swap path to an upstream event documented, so that
    retirement is a small change rather than a rewrite.

## Implementation Decisions

**Modules.** Four, mirroring the shape of the sibling `pi-vim-status`: a pure `mirror` module
(the only seam with interesting logic), a `status-display` module that answers "what does
`pi-x-ide`'s configured display mode resolve to", a `tee` module owning the wrapper, and the
entry module that wires them to pi events and holds all mutable state in one closure.

**Input.** The tee forwards every `setStatus(key, text)` call unchanged, via `Reflect.apply` with
the original receiver, and consumes only calls whose key is exactly `pi-x-ide`. Arguments are
never modified. Consumption happens in a `try`/`finally` around the forward, so a defect in the
mirror cannot stop the caller's own write; the error path is a silent no-op.

**Wrapper shape.** A data property installed on the `ui` object with `writable` and
`configurable` both true and the predecessor's `enumerable` copied. The predecessor is captured
at install time, never looked up at call time. Restore puts the predecessor's descriptor back.

**Wrapper ownership.** Each publish re-reads the own descriptor of `setStatus` on the current `ui`
object; when the own value is not this package's tee, the tee is re-installed above whatever
displaced it, and the publish proceeds. Nothing is logged when this happens.

**Rebind.** The tee is installed in `session_start` and restored in `session_shutdown`, because
pi builds a fresh `ui` object per bind. Installation is idempotent: session state is reset first,
so a second `session_start` on a new object never leaves the previous object wrapped.

**Channel.** One channel only: the Zentui custom-variable bus. This package never calls
`ctx.ui.setStatus`. When Zentui reports the key is not active, the value is cleared rather than
frozen, and the fallback is upstream's own statusline, which is already on the footer surface.

**Capability probe.** A fresh mutable plain object — never frozen, never carrying accessors — is
emitted on `zentui:variable-capability` with this package's publisher key, and re-emitted on
every publish, because Zentui clears all values on every `session_start` and has no
capability-change event. `active` is only trusted when it is exactly `true`.

**Text.** Verbatim apart from three transforms, in this order: strip ANSI sequences and control
characters, fit to the protocol limit, compare with the previously published value. SGR escapes
are stripped because upstream colourises the statusline text and the bus carries plain text.
Fitting cuts at a grapheme boundary at no more than 256 UTF-16 code units, reserving the final
cell for an ellipsis, so the protocol never silently ignores an update. An empty result, and a
`undefined` text, both mean "clear".

**Text policy.** All of upstream's states pass through unchanged: the `✓` connected marker, the
`⇡` pending marker, the `⠋` connecting spinner frames, the `✕` error marker. No format of this
package's own is ever derived from the text, because the text is upstream's and re-deriving it
would break on their next wording change.

**Publisher key.** The fixed string `pi-ide-status:ide`, on every publication. Zentui sorts
custom values by key, so in the `$extensions` aggregate this chip renders before
`pi-vim-status:vim`; adjacency to the Vim chip is a configuration concern, not a package one.

**Diagnostics.** At `session_start`, the effective `status_display` is resolved by reading
`pi-x-ide`'s global configuration and then its project configuration, project overriding global,
using the documented file format. When the effective value is `widget`, one `notify` per session
names the setting and points at `/ide settings`; when the configuration is absent, unreadable, or
names any other value, the package stays silent. The resolved value is never cached across
sessions.

**Failure containment.** Every entry point is total: no `throw` reaches the caller, no async work
is scheduled, and no unreferenced timer or interval is created. A `ui` object without a
`setStatus` data property, a non-TUI mode, and a statusline text of the wrong type are all
"nothing to do".

**Probe shape** (settled during grilling, kept because the mutation-in-place contract is the
easy thing to get wrong):

```ts
type Probe = { supported: boolean; active: boolean; key: string };
const probe: Probe = { supported: false, active: false, key: "pi-ide-status:ide" };
events.emit("zentui:variable-capability", probe);
const active = probe.active === true;
```

**Mirror shape** (the pure seam):

```ts
type Mirror = { text: string | undefined; publish: boolean };
// previous: what was last published; raw: the teed statusline text; active: Zentui's verdict
declare function mirror(
  previous: string | undefined,
  raw: string | undefined,
  active: boolean,
): Mirror;
```

**Packaging.** Installed from git; never published to a registry. `private: true` in the
manifest so an accidental `publish` fails loudly, while `npm` remains the package manager for
development and for the `npm install --omit=dev` that a git install performs.

**Configuration is documented, never written.** The package reads no settings file of its own
and writes none. Three pieces of the user's existing configuration are prerequisites, and the
README documents all three with the symptom of each being wrong:

1. `pi-x-ide` must run with `status_display: "statusline"` (`~/.pi/pi-x-ide/config.json`, project
   config overriding global). With the default `widget` it never calls `setStatus`, and the chip
   has no input at all.
2. The package must appear in the `packages` array of `~/.pi/agent/settings.json` **after**
   `npm:pi-zentui`, per the load-order contract. During development that entry is the checkout's
   absolute path, because this repository has no published history to clone; a release swaps in
   the git form.
3. Zentui's Minimalist style needs an alias naming the publisher key, and a slot referencing it
   to the left of the Vim chip so the IDE chip clips first:

   ```json
   "variables": { "ide": "pi-ide-status:ide", "vim": "pi-vim-status:vim" },
   "formats": { "bottomRight": "$ide $vim" }
   ```

   The alias value is the full publisher key, not a short name. The slot choice is the user's:
   `bottomMiddle` and `bottomLeft` work equally, at the cost of competing with `$cwd` and the git
   branch for the same budget. Without both an alias and a slot referencing it, Zentui reports the
   key as not active, and the chip can only ever reach the `$extensions` aggregate, where it sorts
   ahead of the Vim chip instead of beside it.

## Testing Decisions

**What a good test asserts here.** Only externally observable behaviour at a seam: the arguments
of every `zentui:variable` emission, the `notify` calls, and the descriptor state of a `ui`
object after install and restore. No test reaches into module-private state, and none asserts on
how many times a helper was called when the emitted value already proves it.

**Seam one — the extension factory.** The highest seam available and the one that covers the
dangerous code. A fake `pi` records `events.emit` payloads and captures the `session_start` /
`session_shutdown` handlers; a fake `ui` is a plain object carrying `setStatus` as a real data
property, so the descriptor dance is exercised for real; a temporary home directory holds
`pi-x-ide` configuration files, and the factory is given that directory and a cwd. The test
drives `session_start`, calls the recorded `setStatus` the way upstream would, and asserts the
emitted variable values, the clear-on-inactive behaviour, the warn-once path, the restore on
`session_shutdown`, and re-installation after a simulated rebind.

**Seam two — the pure mirror.** Table-driven, one `test()` per row, so every case reads as a
sentence: verbatim passthrough, SGR stripped, control characters stripped, over-limit fitted with
an ellipsis, cut at a grapheme boundary with no unpaired surrogate, combining marks kept attached
to their base, duplicate suppressed, `undefined` clearing, inactive clearing, and a
change-from-active-to-inactive producing exactly one publication.

**Prior art.** `pi-vim-status`'s `test/reconcile.test.ts` is the model for the pure table and for
its fitting assertions; `pi-copy-paste`'s `test/helpers.ts` is the model for the fake-`pi`
harness, which captures registrations and replays handlers. The smoke test asserting that the
default export is a function stays.

**Deliberately untested.** Real interop with a running `pi-x-ide` and a real Zentui, terminal
widths and clipping, and the animation cadence of upstream's spinner. These are checked by hand
with `pi -e ./src/index.ts` inside a real session, as the README's test plan describes.

**Deliberately tested, unlike the sibling.** The wrapper itself. `pi-vim-status` leaves its glue
untested because it only reads; this package mutates an object that every extension in the
session shares, so a broken restore is a session-wide fault and earns a unit test.

## Out of Scope

- Publishing to npm, or any registry-compatibility promise.
- Reading `pi-x-ide`'s lock files, discovering IDE windows, or reimplementing its candidate
  ranking.
- Opening a WebSocket to the IDE, and therefore structured selection data.
- Relative paths in the chip: upstream's statusline text carries only the basename.
- Zed-, nvim- or JetBrains-specific behaviour beyond what the shared statusline text gives for
  free.
- Any second slot, alias, or publisher key, and any settings file of this package's own.
- Writing, applying or migrating the three configuration files above: they belong to the user and
  to their dotfile manager, and this repository only documents them.
- Acting on the selection: attaching, opening, jumping, or accepting diagnostics.
- Colour configuration for the chip beyond what Zentui already offers per publisher.
- Changing `pi-x-ide` itself. The upstream status event is a separate issue with its own spec.
- Any behaviour in non-TUI sessions.

## Further Notes

**Load order is part of the contract.** The required chain is
`pi-x-ide` → `pi-zentui` → `pi-ide-status`: this package must load after `pi-zentui`, so
Zentui's status controller is already installed when the tee goes over it, finds it is no longer
the owner, and goes inert instead of suppressing publications. The README must state the
required order and the symptom of getting it wrong, which is a permanently empty chip.

**Retirement.** The package exists because `pi-x-ide` publishes no event. When upstream emits its
status on `pi.events`, the tee is deleted and the mirror reads the event instead; everything
downstream is unchanged. When upstream publishes on Zentui's own bus, the package is deleted and
its README says so.

**Compatibility risk.** The tee depends on pi building one `ui` object per bind with `setStatus`
as a data property, on Zentui mutating the probe in place, and on `pi-x-ide` keeping
`status_display: "statusline"` as an option. Each is checked by a test that fails loudly rather
than by a version range, and each is named in the ADR so the next upgrade has a short list.

**Test plan by hand**, for the README rather than a test suite: `/ide settings` → Display →
statusline; open a file in VS Code and watch the chip appear; move the cursor and watch the line
span follow; send a prompt and watch `⇡` become `✓`; close the IDE and watch the chip go away;
narrow the terminal to 60 columns and watch the chip clip while the Vim chip keeps its place;
`/reload` and confirm the chip comes back once, not twice and not never.
