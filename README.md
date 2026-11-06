# pi-ide-status

Show `pi-x-ide`'s connection status in a Zentui Minimalist border slot, without giving up
Zentui's frame.

> Status: scaffolding. The design is settled and written down in [`docs/spec.md`](docs/spec.md);
> the vocabulary is in [`GLOSSARY.md`](GLOSSARY.md) and the one architectural bet in
> [`docs/adr/0001-tee-pi-x-ide-statusline.md`](docs/adr/0001-tee-pi-x-ide-statusline.md). No
> behaviour is implemented yet.

## Install

```sh
pi install git:github.com/balaenis/pi-x-ide
pi install git:github.com/jennymaeleidig/pi-ide-status
pi install npm:pi-zentui
```

## Development

```sh
npm install
npm run typecheck
npm test
npm run format:check
```
