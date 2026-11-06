# pi-ide-status

Bridge between `pi-x-ide` and Zentui: mirror the file and line range the IDE has attached to
the prompt into Zentui's Minimalist border, next to the Vim mode chip. One channel only — the
Zentui custom-variable bus — and nothing at all when no IDE is connected.

## Local testing

`.pi/settings.json` does not commit a dogfood install: a normal pi session in this checkout
does not load the extension. Load it for one run with:

```sh
pi -e ./src/index.ts
```

To dogfood interactively, `pi install --local .` writes `"packages": [".."]` into
`.pi/settings.json`; restart pi or `/reload`, then revert `.pi/settings.json` before
committing. Treat that declaration as a temporary harness, not repo state.

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
