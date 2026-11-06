# pi-ide-status

Bridge between `pi-x-ide` and Zentui: mirror the file and line range the IDE has attached to
the prompt into Zentui's Minimalist border, next to the Vim mode chip. One channel only — the
Zentui custom-variable bus — and nothing at all when no IDE is connected.

## Local testing

`.pi/settings.json` does not commit a dogfood install: a normal pi session in this checkout
does not load the extension.

**Do not load it with `pi -e ./src/index.ts`.** CLI extensions load before installed packages, so
the tee would sit below `pi-zentui`; Zentui's status controller then hides the statusline text
and the chip stays empty. A project-local entry (`pi install --local .`) also loads before the
global packages, so it violates the same load-order contract.

To test, add the checkout's absolute path to the **global** `packages` array in
`~/.pi/agent/settings.json`, immediately after `npm:pi-zentui`, restart pi (or `/reload`), run
the README's hand checks, and remove the entry afterwards. That matches the documented contract:
`pi-x-ide` → `pi-zentui` → `pi-ide-status`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `jennymaeleidig/pi-ide-status`, via the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`. `GLOSSARY.md` and `docs/adr/` are created
lazily, when a term or decision is actually resolved.
