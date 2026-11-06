# pi-ide-status

Show the file and line range open in your IDE in a Zentui Minimalist border slot, next to your
Vim mode chip — and nothing at all when no IDE is connected.

> Status: implemented for the first end-to-end slice. The design is settled and written down in
> [`docs/spec.md`](docs/spec.md); the vocabulary is in [`GLOSSARY.md`](GLOSSARY.md) and the two
> architectural bets in [`docs/adr/0001-tee-pi-x-ide-statusline.md`](docs/adr/0001-tee-pi-x-ide-statusline.md)
> and [`docs/adr/0002-retry-the-startup-value.md`](docs/adr/0002-retry-the-startup-value.md).

## Install

Load order is part of the contract:

```text
pi-ide-status  ->  pi-x-ide  ->  pi-zentui
```

```sh
pi install git:github.com/jennymaeleidig/pi-ide-status
pi install npm:pi-x-ide
pi install npm:pi-zentui
```

This package must load **before** `pi-x-ide`. The tee has to exist when `pi-x-ide` publishes its
startup statusline from its asynchronous `session_start`; loaded after it, the tee misses that
first text and the chip stays empty until the next IDE or prompt event. Zentui may install its
own controller over the tee later in the same start, so every publish re-installs the tee above
it.

## Configuration

Three things must already be true. This package writes none of them, and reads only the first.

1. **`pi-x-ide` uses the statusline placement.** `/ide settings` → Display → statusline, or
   `"status_display": "statusline"` in `~/.pi/pi-x-ide/config.json`. This package reads that
   value to warn you when it is wrong. With the default `widget`, `pi-x-ide` never calls
   `setStatus`, so there is nothing to mirror and the chip silently never appears.
2. **Zentui names the publisher key and references it in a slot.** In the `minimalist` style,
   under `variables` and `formats`:

   ```json
   "variables": { "ide": "pi-ide-status:ide", "vim": "pi-vim-status:vim" },
   "formats": { "bottomRight": "$ide $vim" }
   ```

   The alias value is the full publisher key, not a short name. Without both the alias and a
   slot that references it, Zentui reports the key as not active and the chip can only reach the
   `$extensions` aggregate, where it sorts alphabetically instead of sitting beside the Vim chip.

   Keep `pi-x-ide` hidden in Zentui's extension-status visibility (`extensionStatuses`). This
   package mirrors the same statusline text into the slot, so marking `pi-x-ide` as `show`
   renders upstream's own statusline a second time, in Zentui's extension-status surface. The
   alias and slot are the only surface this package needs.

3. **The package is the first entry** in the `packages` array of
   `~/.pi/agent/settings.json`, ahead of `npm:pi-x-ide`. That is load order again, and the
   symptom is the same one: an empty slot until the next IDE or prompt event.
   empty slot and nothing in the log.

## Test by hand

With the three prerequisites met and the checkout loaded first (see Development), run through
these in a real session:

1. `/ide settings` → Display → statusline, then open a file in VS Code. The chip appears in the
   configured slot as `⧉ ✓ basename` before you type or send a prompt. If it does not, recheck
   the prerequisites and load order above before suspecting the package.
2. Move the cursor in VS Code. The line span follows (`index.ts#L12-L15`).
3. Send a prompt with a selection attached. The pending marker `⇡` becomes `✓` once the selection
   is attached.
4. Close the IDE. The chip disappears. Run `/ide off`: it stays gone. Reconnect and it returns.
5. Narrow the terminal to 60 columns. Zentui drops the chip while the Vim chip keeps its place.
   This is intended: a chip that does not fit is omitted rather than drawn broken.
6. Run `/reload`. The chip comes back exactly once — not twice, and not never.
7. Set `status_display` to `widget` and start a new session. Exactly one warning names
   `status_display` and `/ide settings`, and no chip appears, because `pi-x-ide` writes no
   statusline text to mirror.

The chip carries upstream's own text and inherits the Zentui theme; it invents no colour or
formatting beyond the ellipsis used when a fitted value exceeds the protocol limit.

## Retirement

The package exists because `pi-x-ide` publishes no status event. If upstream starts emitting its
status on `pi.events`, delete the tee (`src/tee.ts`) and feed the mirror from that event; the
mirror, fitting, deduplication and Zentui publication stay unchanged. If upstream publishes
straight onto Zentui's custom-variable bus, delete this package entirely — its README will say
so. Until then, the tee and the load-order contract above are the compatibility surface.

## Development

```sh
npm install
npm run typecheck
npm test
npm run format:check
```

Load the checkout in place for one session, without publishing it:

```sh
pi -e ./src/index.ts
```

CLI extensions load before installed packages, which is the required position: the tee exists
before `pi-x-ide` publishes. Do not also list the checkout in `packages` while using `-e`; pi
deduplicates the copy by resolved path and keeps the CLI one, which is already in the right slot.

For a persistent local install, make the checkout the **first** entry in the **global** `packages`
array in `~/.pi/agent/settings.json`, then **fully exit pi and start a fresh `pi`**:

```json
"packages": [
  "/Users/you/Documents/projects/pi-extensions/pi-ide-status",
  "npm:@ff-labs/pi-fff",
  "npm:pi-x-ide",
  "npm:pi-zentui"
]
```

Run the hand checks above, then remove the entry. This is the same load-order rule as the
install instructions, just with a local checkout instead of the git package.

A full restart is required whenever the package list or this entry's position changes.
`/reload` keeps any `-e` extension first, which is now the correct position, but a stale process
started under the old order still has to be replaced.
