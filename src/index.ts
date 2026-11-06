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

type EditorFactory = NonNullable<ReturnType<ExtensionUIContext["getEditorComponent"]>>;
type Editor = ReturnType<EditorFactory>;

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
  /** The last value upstream wrote, kept so a render can retry a startup probe. */
  let latest: string | undefined;
  let scheduled = false;
  let observed = new WeakSet<Editor>();
  let editorUi: ExtensionUIContext | undefined;
  let previousFactory: EditorFactory | undefined;
  let installedFactory: EditorFactory | undefined;

  const refresh = (): void => {
    const target = ui;
    const activeTee = tee;
    if (target === undefined || activeTee === undefined) return;
    observeEditor(target);

    // A later tee may have taken the own property since the last publish.
    activeTee.ensure(target);

    const probe: Probe = { supported: false, active: false, key: PUBLISHER_KEY };
    pi.events.emit(CAPABILITY_EVENT, probe);
    const active = probe.active === true;

    const result = mirror(previous, latest, active);
    previous = result.text;
    if (!result.publish) return;

    pi.events.emit(VARIABLE_EVENT, { key: PUBLISHER_KEY, text: result.text });
  };

  const publish = (raw: string | undefined): void => {
    latest = raw;
    refresh();
  };

  /** One refresh per render, after the frame, so a publish cannot reenter rendering. */
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      if (!scheduled) return;
      scheduled = false;
      try {
        refresh();
      } catch {
        // Failure containment: a render refresh never escapes as an uncaught microtask.
      }
    });
  };

  const observeRender = (editor: Editor): void => {
    const render = editor.render;
    if (typeof render !== "function") return;
    try {
      editor.render = function (this: Editor, width: number): string[] {
        schedule();
        return render.call(this, width);
      };
    } catch {
      // A frozen editor is nothing to observe; the event-driven path still works.
    }
  };

  /** Observe the current editor's render, once per bind, with the shape pi actually exposes. */
  const observeEditor = (target: ExtensionUIContext): void => {
    if (editorUi !== undefined) return;
    if (typeof target.getEditorComponent !== "function") return;
    if (typeof target.setEditorComponent !== "function") return;

    let factory: EditorFactory | undefined;
    try {
      factory = target.getEditorComponent();
    } catch {
      return;
    }
    if (factory === undefined) return;

    const observedFactory: EditorFactory = (tui, theme, keybindings) => {
      const editor = factory(tui, theme, keybindings);
      if (!observed.has(editor)) {
        observed.add(editor);
        observeRender(editor);
      }
      return editor;
    };
    try {
      target.setEditorComponent(observedFactory);
    } catch {
      return;
    }
    editorUi = target;
    previousFactory = factory;
    installedFactory = observedFactory;
  };

  /** Drop the previous bind: restore its `ui`, then reset every session value. */
  const reset = (): void => {
    if (ui !== undefined && tee !== undefined) tee.restore(ui);
    if (editorUi !== undefined && installedFactory !== undefined && previousFactory !== undefined) {
      try {
        if (editorUi.getEditorComponent?.() === installedFactory) {
          editorUi.setEditorComponent?.(previousFactory);
        }
      } catch {
        // A bind that no longer accepts a factory is already on its way out.
      }
    }
    ui = undefined;
    tee = undefined;
    previous = undefined;
    latest = undefined;
    scheduled = false;
    observed = new WeakSet<Editor>();
    editorUi = undefined;
    previousFactory = undefined;
    installedFactory = undefined;
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

      // Zentui can report inactive before its editor is safely decorated. Observe
      // renders so the retained value can be published once it is ready.
      observeEditor(target);
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
