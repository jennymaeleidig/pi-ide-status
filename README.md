# pi-ide-status

Show the file and line range open in your IDE in a Zentui Minimalist border slot, next to your
Vim mode chip — and nothing at all when no IDE is connected.

> Status: implemented for the first end-to-end slice. The design is settled and written down in
> [`docs/spec.md`](docs/spec.md); the vocabulary is in [`GLOSSARY.md`](GLOSSARY.md) and the two
> architectural bets in [`docs/adr/0001-tee-pi-x-ide-statusline.md`](docs/adr/0001-tee-pi-x-ide-statusline.md)
> and [`docs/adr/0002-republish-on-editor-render.md`](docs/adr/0002-republish-on-editor-render.md).

## Install

Load order is part of the contract:

```text
pi-x-ide  ->  pi-zentui  ->  pi-ide-status
```

```sh
pi install npm:pi-x-ide
pi install npm:pi-zentui
pi install git:github.com/jennymaeleidig/pi-ide-status
```

This package must load **after** `pi-zentui`. It goes over Zentui's own `ctx.ui.setStatus`
descriptor, and Zentui only steps aside if it is already installed when the tee lands. Loaded
before `pi-zentui`, the chip stays empty for the whole session, with no error.

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

3. **The package sits after `npm:pi-zentui`** in the `packages` array of
   `~/.pi/agent/settings.json`. That is load order again, and the symptom is the same one: an
   empty slot and nothing in the log.

## Test by hand

With the three prerequisites met and the checkout loaded after `pi-zentui` (see Development), run
through these in a real session:

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

Load the checkout in place for one session, without publishing it. **Do not use
`pi -e ./src/index.ts` for this package:** CLI extensions load before installed packages, so the
tee would sit _below_ `pi-zentui` and Zentui's status controller would hide the statusline
text. A project-local entry (`pi install --local .`) also loads before global packages, so it
does not satisfy the contract either.

Instead, add the checkout to the **global** `packages` array in `~/.pi/agent/settings.json`,
immediately after `npm:pi-zentui`, then **fully exit pi and start a fresh `pi`**:

```json
"packages": [
  "npm:pi-x-ide",
  "npm:pi-zentui",
  "/Users/you/Documents/projects/pi-extensions/pi-ide-status",
  "npm:cc-safety-net"
]
```

Run the hand checks above, then remove the entry. This is the same load-order rule as the
install instructions, just with a local checkout instead of the git package.

A full restart is required whenever the package list or this entry's position changes.
`/reload` keeps any `-e` extension in front of the installed packages, and pi deduplicates the
`-e` copy against the package copy by resolved path. The surviving copy stays below `pi-zentui`,
so the tee sees only the hidden `undefined` and the chip never fills.
