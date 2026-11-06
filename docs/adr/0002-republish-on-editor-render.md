# 0002 — Republish the retained startup text on the editor's render

**Status**: Accepted — 2026-11-06

## Context

The chip is published on Zentui's custom-variable bus only while Zentui answers a capability
probe with `active: true`. Zentui computes that answer from configuration demand **and** a
minimalist editor it has safely decorated. At startup, `session_start` handlers run before the
first editor factory is invoked. Zentui's own documentation records the consequence: "Startup
probes may precede the first safe editor render: probe again on the publisher's next refresh",
and positive updates while inactive are ignored rather than retained.

`pi-x-ide` publishes its first statusline text during that same startup window. Without a later
refresh, the first publish in a session is dropped. The chip then appears only when some later
upstream event — a cursor move, a focus change, or sending a prompt — produces another
`setStatus` call. `pi-vim-status` avoids the gap by synchronising after each editor render.

## Decision

Retain the latest teed value. Observe the current editor factory in `session_start`, observe
each render, and schedule at most one refresh per microtask after the frame. The refresh probes
again and republishes the retained value when the capability becomes active. The package
substitutes a pass-through factory and an observed `render`; it owns no editor, draws nothing,
and returns the editor's lines untouched.

This is the one place the package observes a surface other than `setStatus`. It exists only to
retry a probe that could not be answered yet, and it starts no timer, opens no socket and polls
no directory.

## Consequences

- The chip appears before the user types or sends a prompt, matching upstream's own statusline
  without requiring a cursor move.
- A delayed activation after a narrow terminal, a rule change, or editor re-enable also heals on
  the next render, because every render refreshes.
- The package now depends on `getEditorComponent` and `setEditorComponent` remaining public on
  the TUI context, and on the editor exposing a callable, assignable `render`. A missing or
  different shape leaves the event-driven path working; only the startup retry is lost.
- The retained value survives an inactive probe, so a later refresh never has to wait for another
  upstream event.
- The editor factory and each observed editor's `render` are restored or rebound with the
  session, so a shutdown does not leave the old `ui` pointing at a live refresh path.

## Alternatives considered

**A delayed one-shot timer.** It is a guess about when the first frame has happened, adds a
resource the spec forbids, and needs cancel-on-shutdown bookkeeping.

**Publish the value optimistically before the probe.** Zentui discards positive updates while
inactive, so the value still would not be retained.

**Wait for the next upstream status.** This is the behaviour being fixed: `pi-x-ide` may emit only
once on startup when the IDE is already connected.

**Rely on `agent_start` or `input`.** Both make the chip appear only after the user starts
interacting, while the requirement is that it describes the attached selection before typing.
