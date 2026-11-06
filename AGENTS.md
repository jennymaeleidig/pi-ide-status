# pi-ide-status

Bridge between `pi-x-ide` and Zentui: mirror the file and line range the IDE has attached to
the prompt into Zentui's Minimalist border, next to the Vim mode chip. One channel only — the
Zentui custom-variable bus — and nothing at all when no IDE is connected.

## Local testing

`.pi/settings.json` does not commit a dogfood install: a normal pi session in this checkout
does not load the extension.

Load it with `pi -e ./src/index.ts`. CLI extensions load before installed packages, which is the
required position: the tee must exist before `pi-x-ide` publishes from its asynchronous
`session_start`. Do not also list the checkout in `packages` while using `-e`; pi deduplicates
by resolved path and keeps the CLI copy, which is already first.

For a persistent local install, make the checkout the **first** entry in the **global**
`packages` array in `~/.pi/agent/settings.json`, then fully exit pi and start a fresh `pi`. Run
the README's hand checks, then remove the entry. The contract is
`pi-ide-status` → `pi-x-ide` → `pi-zentui`: load after `pi-x-ide` and the tee misses upstream's
startup text; Zentui installing later is handled by the tee re-asserting itself on publish.

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
