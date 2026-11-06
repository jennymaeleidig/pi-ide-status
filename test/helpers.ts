import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import extension from "../src/index.ts";

export type Emitted = Readonly<{ channel: string; data: unknown }>;
export type StatusCall = Readonly<{ key: string; text: string | undefined }>;
export type Notice = Readonly<{ message: string; type: string | undefined }>;

export interface FakeEditor {
  render(width: number): string[];
}

export interface FakeUi {
  ui: ExtensionUIContext;
  calls: StatusCall[];
  notices: Notice[];
  /** Invoke the installed editor factory and render one frame. */
  renderEditor(width?: number): string[];
  /** The factory the ui would instantiate, for restore assertions. */
  currentEditorFactory(): unknown;
}

/** A `ui` whose `setStatus` is a real, plain data property, as pi builds it. */
export function createUi(options: { editor?: boolean; frozenRender?: boolean } = {}): FakeUi {
  const calls: StatusCall[] = [];
  const notices: Notice[] = [];
  let editor: FakeEditor | undefined;
  let factory: ((tui: unknown, theme: unknown, keybindings: unknown) => FakeEditor) | undefined;
  if (options.editor === true) {
    factory = () => {
      if (editor !== undefined) return editor;
      editor = { render: (width: number) => [`rendered ${width}`] };
      if (options.frozenRender === true) {
        Object.defineProperty(editor, "render", {
          value: editor.render,
          writable: false,
          configurable: false,
        });
      }
      return editor;
    };
  }
  const ui = {
    setStatus(key: string, text: string | undefined): void {
      calls.push({ key, text });
    },
    notify(message: string, type?: "info" | "warning" | "error"): void {
      notices.push({ message, type });
    },
    ...(options.editor === true
      ? {
          getEditorComponent: () => factory,
          setEditorComponent: (next: typeof factory) => {
            factory = next;
          },
        }
      : {}),
  };
  const renderEditor = (width = 80): string[] => {
    if (factory === undefined) throw new Error("no editor component is installed");
    return factory({}, {}, {}).render(width);
  };
  return {
    ui: ui as unknown as ExtensionUIContext,
    calls,
    notices,
    renderEditor,
    currentEditorFactory: () => factory,
  };
}

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

export interface StartOptions {
  ui: ExtensionUIContext;
  mode?: ExtensionContext["mode"];
  cwd?: string;
}

export interface Harness {
  emitted: Emitted[];
  /** Answer Zentui's capability probe the way an enabled Zentui does. */
  setZentuiActive(active: boolean): void;
  start(options: StartOptions): Promise<void>;
  shutdown(options: StartOptions): Promise<void>;
}

/**
 * Drive the factory through a fake pi: capture `events.emit`, answer the
 * capability probe in place, and replay session handlers against a fake ctx.
 */
export function createHarness(options: { home: string }): Harness {
  let zentuiActive = true;
  const emitted: Emitted[] = [];
  const handlers = new Map<string, Handler>();

  const events = {
    emit(channel: string, data: unknown): void {
      emitted.push({ channel, data });
      if (channel === "zentui:variable-capability" && typeof data === "object" && data !== null) {
        (data as { active: boolean }).active = zentuiActive;
      }
    },
    on(): () => void {
      return () => {};
    },
  };

  const pi = {
    on(event: string, handler: Handler): () => void {
      handlers.set(event, handler);
      return () => {};
    },
    events,
  } as unknown as ExtensionAPI;

  extension(pi, { home: options.home });

  const invoke = async (event: string, ctx: ExtensionContext): Promise<void> => {
    const handler = handlers.get(event);
    if (handler === undefined) throw new Error(`the extension did not register ${event}`);
    await handler({ type: event }, ctx);
  };

  const context = (start: StartOptions): ExtensionContext =>
    ({
      ui: start.ui,
      mode: start.mode ?? "tui",
      cwd: start.cwd ?? process.cwd(),
    }) as ExtensionContext;

  return {
    emitted,
    setZentuiActive(active: boolean): void {
      zentuiActive = active;
    },
    async start(start: StartOptions): Promise<void> {
      await invoke("session_start", context(start));
    },
    async shutdown(start: StartOptions): Promise<void> {
      await invoke("session_shutdown", context(start));
    },
  };
}

/** Write a pi-x-ide configuration holding one `status_display` value. */
export async function writePiXIdeConfig(root: string, value: unknown): Promise<void> {
  await writePiXIdeConfigText(root, JSON.stringify({ status_display: value }));
}

/** Write a pi-x-ide configuration file verbatim, for malformed fixtures. */
export async function writePiXIdeConfigText(root: string, text: string): Promise<void> {
  const directory = join(root, ".pi", "pi-x-ide");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "config.json"), text, "utf8");
}

/** The `zentui:variable` payloads, in order. */
export function variables(harness: Harness): Array<{ key: string; text?: string }> {
  return harness.emitted
    .filter((event) => event.channel === "zentui:variable")
    .map((event) => event.data as { key: string; text?: string });
}

/** The `zentui:variable-capability` probes, in order. */
export function probes(
  harness: Harness,
): Array<{ supported: boolean; active: boolean; key: string }> {
  return harness.emitted
    .filter((event) => event.channel === "zentui:variable-capability")
    .map((event) => event.data as { supported: boolean; active: boolean; key: string });
}
