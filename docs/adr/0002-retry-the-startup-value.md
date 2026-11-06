# 0002 — Retry the startup value with a bounded timer

**Status**: Accepted — 2026-11-06

## Context

The chip is published on Zentui's custom-variable bus only while Zentui answers a capability
probe with `active: true`. Zentui computes that answer from configuration demand **and** a
minimalist editor it has safely decorated. At startup, the probe can precede that decoration.
Zentui's own documentation records the consequence: "Startup probes may precede the first safe
editor render: probe again on the publisher's next refresh", and positive updates while inactive
are ignored rather than retained.

`pi-x-ide` publishes its first statusline text during that same startup window. Without a later
refresh, the first publish in a session is dropped. The chip then appears only when some later
upstream event — a cursor move, a focus change, or sending a prompt — produces another
`setStatus` call.

An editor-render hook was tried first. It is not reliable here: the TUI can create its editor
instance before `session_start`, and a new session in the same process reuses that instance. A
factory installed afterwards never wraps the live editor, so no render fires through it. The
package owns no editor and must not replace one to make the chip appear.

## Decision

Retain the latest teed value. When a publish is rejected because Zentui is inactive, retry the
probe every 100 ms for at most 3 seconds. The retry stops at the first active verdict, on
`session_shutdown`, or after the limit; a later upstream publish starts a fresh window. Every
timer handle is cleared when it stops.

This is the only timer in the package. It exists only after Zentui rejects a value it should
accept, and it is bounded and cancelled rather than a persistent poll.

## Consequences

- The chip appears before the user types or sends a prompt, matching upstream's own statusline
  without requiring a cursor move.
- Slow first renders are covered without guessing a single delay; a normal session stops the
  retry on its first or second tick.
- A permanently inactive capability (for example, the alias is missing) costs 30 probes over
  3 seconds once per startup publish, then stops.
- The retained value survives an inactive probe, so a later refresh never has to wait for
  another upstream event.
- Shutdown, rebind and reload clear the handle; nothing survives the session that started it.

## Alternatives considered

**An editor-render hook.** It failed in practice because the editor instance predates the hook
and survives a new session. It also required substituting the editor factory, which the package
otherwise avoids.

**A single delayed timer.** It is a guess about when the first render has happened and breaks on
a slower terminal or a later session.

**Publish the value optimistically before the probe.** Zentui discards positive updates while
inactive, so the value still would not be retained.

**Wait for the next upstream status.** This is the behaviour being fixed: `pi-x-ide` may emit only
once on startup when the IDE is already connected.

**Rely on `agent_start` or `input`.** Both make the chip appear only after the user starts
interacting, while the requirement is that it describes the attached selection before typing.
