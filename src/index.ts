import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { mirror } from "./mirror.ts";
import { resolveStatusDisplay } from "./status-display.ts";
import type { Tee } from "./tee.ts";
import { createTee } from "./tee.ts";

/** The fixed publisher key every value is published under. */
const PUBLISHER_KEY = "pi-ide-status:ide";
const CAPABILITY_EVENT = "zentui:variable-capability";
const VARIABLE_EVENT = "zentui:variable";

/** The mutable probe Zentui answers in place. */
type Probe = { supported: boolean; active: boolean; key: string };

/** Test seam for the configuration root; pi passes only the API. */
type Options = { home?: string };

/**
 * Mirror pi-x-ide's statusline text into a Zentui border slot. The tee is
 * installed on the bind's `ui` object at session start, forwards every call,
 * and copies only the ones keyed `pi-x-ide`. All mutable state lives here.
 */
export default function piIdeStatus(pi: ExtensionAPI, options: Options = {}): void {
  const home = options.home ?? homedir();

  let ui: ExtensionUIContext | undefined;
  let tee: Tee | undefined;
  let previous: string | undefined;

  const publish = (raw: string | undefined): void => {
    const target = ui;
    const activeTee = tee;
    if (target === undefined || activeTee === undefined) return;

    // A later tee may have taken the own property since the last publish.
    activeTee.ensure(target);

    const probe: Probe = { supported: false, active: false, key: PUBLISHER_KEY };
    pi.events.emit(CAPABILITY_EVENT, probe);
    const active = probe.active === true;

    const result = mirror(previous, raw, active);
    previous = result.text;
    if (!result.publish) return;

    pi.events.emit(VARIABLE_EVENT, { key: PUBLISHER_KEY, text: result.text });
  };

  /** Drop the previous bind: restore its `ui`, then reset every session value. */
  const reset = (): void => {
    if (ui !== undefined && tee !== undefined) tee.restore(ui);
    ui = undefined;
    tee = undefined;
    previous = undefined;
  };

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    try {
      reset();

      const target = ctx.ui;
      if (resolveStatusDisplay({ home, cwd: ctx.cwd }) === "widget") {
        try {
          target.notify(
            `pi-ide-status: pi-x-ide's status_display is "widget", so it writes no statusline ` +
              `text to mirror. Set Display to "statusline" with /ide settings.`,
            "warning",
          );
        } catch {
          // A warning is diagnostic only; never let it block the tee.
        }
      }

      const next = createTee(publish);
      if (!next.install(target)) return;
      ui = target;
      tee = next;
    } catch {
      // Failure containment: no throw from this package reaches pi's session start.
    }
  });

  pi.on("session_shutdown", () => {
    try {
      reset();
    } catch {
      // Failure containment: no throw from this package reaches pi's session shutdown.
    }
  });
}
