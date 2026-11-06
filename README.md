# pi-ide-status

Show the file and line range open in your IDE in a Zentui Minimalist border slot, next to your
Vim mode chip — and nothing at all when no IDE is connected.

> Status: scaffolding. The design is settled and written down in [`docs/spec.md`](docs/spec.md);
> the vocabulary is in [`GLOSSARY.md`](GLOSSARY.md) and the one architectural bet in
> [`docs/adr/0001-tee-pi-x-ide-statusline.md`](docs/adr/0001-tee-pi-x-ide-statusline.md). No
> behaviour is implemented yet.

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

3. **The package sits after `npm:pi-zentui`** in the `packages` array of
   `~/.pi/agent/settings.json`. That is load order again, and the symptom is the same one: an
   empty slot and nothing in the log.

## Development

```sh
npm install
npm run typecheck
npm test
npm run format:check
```

Load the checkout in place for one session, without installing it:

```sh
pi -e ./src/index.ts
```
