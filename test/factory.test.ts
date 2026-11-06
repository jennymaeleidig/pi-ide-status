import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createTee } from "../src/tee.ts";
import {
  createHarness,
  createUi,
  probes,
  variables,
  writePiXIdeConfig,
  writePiXIdeConfigText,
} from "./helpers.ts";

async function tempHome(t: TestContext): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "pi-ide-status-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return home;
}

test("the factory installs the tee, mirrors every upstream state and restores it", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  const before = Object.getOwnPropertyDescriptor(fake.ui, "setStatus");

  await harness.start({ ui: fake.ui });
  const installed = Object.getOwnPropertyDescriptor(fake.ui, "setStatus");
  assert.ok(installed !== undefined);
  assert.notEqual(installed.value, before?.value);

  fake.ui.setStatus("pi-x-ide", "\u001b[2m⧉ ⠋\u001b[0m");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts#L12-L15");
  fake.ui.setStatus("pi-x-ide", "⧉ ⇡ index.ts#L12-L15");
  fake.ui.setStatus("pi-x-ide", "⧉ ✕");

  assert.deepEqual(variables(harness), [
    { key: "pi-ide-status:ide", text: "⧉ ⠋" },
    { key: "pi-ide-status:ide", text: "⧉ ✓ index.ts" },
    { key: "pi-ide-status:ide", text: "⧉ ✓ index.ts#L12-L15" },
    { key: "pi-ide-status:ide", text: "⧉ ⇡ index.ts#L12-L15" },
    { key: "pi-ide-status:ide", text: "⧉ ✕" },
  ]);

  // Every teed call reaches the predecessor unchanged, with its original text.
  assert.deepEqual(fake.calls, [
    { key: "pi-x-ide", text: "\u001b[2m⧉ ⠋\u001b[0m" },
    { key: "pi-x-ide", text: "⧉ ✓ index.ts" },
    { key: "pi-x-ide", text: "⧉ ✓ index.ts#L12-L15" },
    { key: "pi-x-ide", text: "⧉ ⇡ index.ts#L12-L15" },
    { key: "pi-x-ide", text: "⧉ ✕" },
  ]);
  assert.ok(
    fake.calls.every((call) => call.key !== "pi-ide-status:ide"),
    "this package never writes its own publisher key to ctx.ui.setStatus",
  );

  await harness.shutdown({ ui: fake.ui });
  assert.deepEqual(Object.getOwnPropertyDescriptor(fake.ui, "setStatus"), before);
});

test("two teed calls carrying different text produce two published values", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ a.ts");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ b.ts");

  assert.deepEqual(
    variables(harness).map((value) => value.text),
    ["⧉ ✓ a.ts", "⧉ ✓ b.ts"],
  );
});

test("a duplicate of the previously published value emits nothing", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");

  assert.equal(variables(harness).length, 1);
});

test("a call under another key forwards unchanged and publishes nothing", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide:extra", "⧉ ✕");
  fake.ui.setStatus("pi-vim-status:vim", "NORMAL");

  assert.deepEqual(variables(harness), []);
  assert.deepEqual(fake.calls, [
    { key: "pi-x-ide:extra", text: "⧉ ✕" },
    { key: "pi-vim-status:vim", text: "NORMAL" },
  ]);
});

test("upstream sending undefined clears the chip", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  fake.ui.setStatus("pi-x-ide", undefined);

  assert.deepEqual(variables(harness), [
    { key: "pi-ide-status:ide", text: "⧉ ✓ index.ts" },
    { key: "pi-ide-status:ide", text: undefined },
  ]);
});

test("a wrong-typed statusline text leaves the published value alone", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  const wrongType = 42 as unknown as string;
  fake.ui.setStatus("pi-x-ide", wrongType);

  assert.deepEqual(variables(harness), [{ key: "pi-ide-status:ide", text: "⧉ ✓ index.ts" }]);
  assert.equal(fake.calls.at(-1)?.text, wrongType);
});

test("a tee installed after ours keeps both the chip and its own calls", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  const laterConsumed: Array<string | undefined> = [];
  const later = createTee((text) => laterConsumed.push(text));
  later.install(fake.ui);

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ one.ts");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ two.ts");

  assert.deepEqual(
    variables(harness).map((value) => value.text),
    ["⧉ ✓ one.ts", "⧉ ✓ two.ts"],
  );
  assert.deepEqual(laterConsumed, ["⧉ ✓ one.ts", "⧉ ✓ two.ts"]);
});

test("an inactive Zentui verdict clears the chip rather than freezing it", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  harness.setZentuiActive(false);
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts#L12-L15");

  assert.deepEqual(variables(harness), [
    { key: "pi-ide-status:ide", text: "⧉ ✓ index.ts" },
    { key: "pi-ide-status:ide", text: undefined },
  ]);
  assert.equal(probes(harness).at(-1)?.active, false);
});

test("every publish re-emits a fresh mutable capability probe", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  await harness.start({ ui: fake.ui });

  fake.ui.setStatus("pi-x-ide", "⧉ ⠋");
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");

  const emitted = probes(harness);
  assert.equal(emitted.length, 2);
  assert.notEqual(emitted[0], emitted[1]);
  for (const probe of emitted) {
    assert.deepEqual(
      { supported: probe.supported, key: probe.key },
      { supported: false, key: "pi-ide-status:ide" },
    );
    assert.equal(Object.isFrozen(probe), false);
  }
});

test("a second session_start on a new ui restores the previous object", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const first = createUi();
  const second = createUi();
  const before = Object.getOwnPropertyDescriptor(first.ui, "setStatus");

  await harness.start({ ui: first.ui });
  await harness.start({ ui: second.ui });

  assert.deepEqual(Object.getOwnPropertyDescriptor(first.ui, "setStatus"), before);
  assert.notDeepEqual(Object.getOwnPropertyDescriptor(second.ui, "setStatus"), before);

  second.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  assert.deepEqual(variables(harness), [{ key: "pi-ide-status:ide", text: "⧉ ✓ index.ts" }]);
});

test("each rebind brings the chip back once and restores that bind's ui", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const published: Array<string | undefined> = [];

  for (const reason of ["reload", "new session", "session switch"]) {
    const fake = createUi();
    const before = Object.getOwnPropertyDescriptor(fake.ui, "setStatus");
    await harness.start({ ui: fake.ui });
    fake.ui.setStatus("pi-x-ide", `⧉ ✓ ${reason}.ts`);
    await harness.shutdown({ ui: fake.ui });
    assert.deepEqual(Object.getOwnPropertyDescriptor(fake.ui, "setStatus"), before);
  }

  for (const value of variables(harness)) published.push(value.text);
  assert.deepEqual(published, ["⧉ ✓ reload.ts", "⧉ ✓ new session.ts", "⧉ ✓ session switch.ts"]);
});

test("session_shutdown restores the tee even when its context reports another mode", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  const before = Object.getOwnPropertyDescriptor(fake.ui, "setStatus");

  await harness.start({ ui: fake.ui });
  await harness.shutdown({ ui: fake.ui, mode: "print" });

  assert.deepEqual(Object.getOwnPropertyDescriptor(fake.ui, "setStatus"), before);
});

test("a non-TUI session leaves the ui untouched and emits nothing", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();
  const before = Object.getOwnPropertyDescriptor(fake.ui, "setStatus");

  await harness.start({ ui: fake.ui, mode: "print" });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ index.ts");
  await harness.shutdown({ ui: fake.ui, mode: "print" });

  assert.deepEqual(Object.getOwnPropertyDescriptor(fake.ui, "setStatus"), before);
  assert.deepEqual(variables(harness), []);
  assert.deepEqual(harness.emitted, []);
});

test("a ui without a setStatus data property is nothing to do", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const ui = { notify: () => {} } as unknown as ExtensionUIContext;

  await assert.doesNotReject(async () => {
    await harness.start({ ui });
    await harness.shutdown({ ui });
  });
  assert.deepEqual(harness.emitted, []);
});

test("a widget configuration warns once per session, naming the setting and the fix", async (t) => {
  const home = await tempHome(t);
  await writePiXIdeConfig(home, "widget");
  const harness = createHarness({ home });
  const first = createUi();
  const second = createUi();

  await harness.start({ ui: first.ui });
  first.ui.setStatus("pi-x-ide", "⧉ ✓ one.ts");
  first.ui.setStatus("pi-x-ide", "⧉ ✓ two.ts");
  assert.equal(first.notices.length, 1);
  assert.equal(first.notices[0]?.type, "warning");
  assert.match(first.notices[0]?.message ?? "", /status_display/);
  assert.match(first.notices[0]?.message ?? "", /\/ide settings/);

  await harness.start({ ui: second.ui });
  assert.equal(second.notices.length, 1, "a new session warns again");
});

test("a widget configuration warns even when there is no setStatus to tee", async (t) => {
  const home = await tempHome(t);
  await writePiXIdeConfig(home, "widget");
  const harness = createHarness({ home });
  const notices: Array<{ message: string; type: string | undefined }> = [];
  const ui = {
    notify(message: string, type?: "info" | "warning" | "error"): void {
      notices.push({ message, type });
    },
  } as unknown as ExtensionUIContext;

  await harness.start({ ui });

  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.type, "warning");
  assert.deepEqual(harness.emitted, []);
});

test("a statusline configuration stays silent", async (t) => {
  const home = await tempHome(t);
  await writePiXIdeConfig(home, "statusline");
  const harness = createHarness({ home });
  const fake = createUi();

  await harness.start({ ui: fake.ui });

  assert.deepEqual(fake.notices, []);
});

test("a project configuration overrides the warned global one", async (t) => {
  const home = await tempHome(t);
  const cwd = await tempHome(t);
  await writePiXIdeConfig(home, "widget");
  await writePiXIdeConfig(cwd, "statusline");
  const harness = createHarness({ home });
  const fake = createUi();

  await harness.start({ ui: fake.ui, cwd });

  assert.deepEqual(fake.notices, []);
});

test("a project widget value raises the warning over a global statusline", async (t) => {
  const home = await tempHome(t);
  const cwd = await tempHome(t);
  await writePiXIdeConfig(home, "statusline");
  await writePiXIdeConfig(cwd, "widget");
  const harness = createHarness({ home });
  const fake = createUi();

  await harness.start({ ui: fake.ui, cwd });

  assert.equal(fake.notices.length, 1);
  assert.equal(fake.notices[0]?.type, "warning");
  assert.match(fake.notices[0]?.message ?? "", /status_display/);
  assert.match(fake.notices[0]?.message ?? "", /\/ide settings/);
});

test("a malformed configuration stays silent", async (t) => {
  const home = await tempHome(t);
  await writePiXIdeConfigText(home, "{ not json");
  const harness = createHarness({ home });
  const fake = createUi();

  await harness.start({ ui: fake.ui });

  assert.deepEqual(fake.notices, []);
});

test("an unrecognised configuration value stays silent", async (t) => {
  const home = await tempHome(t);
  await writePiXIdeConfig(home, "sidebar");
  const harness = createHarness({ home });
  const fake = createUi();

  await harness.start({ ui: fake.ui });

  assert.deepEqual(fake.notices, []);
});

test("a configuration change takes effect on the next session", async (t) => {
  const home = await tempHome(t);
  const cwd = await tempHome(t);
  await writePiXIdeConfig(home, "widget");
  const harness = createHarness({ home });
  const first = createUi();
  const second = createUi();

  await harness.start({ ui: first.ui, cwd });
  assert.equal(first.notices.length, 1);

  await harness.shutdown({ ui: first.ui });
  await writePiXIdeConfig(home, "statusline");
  await harness.start({ ui: second.ui, cwd });

  assert.deepEqual(second.notices, []);
});

test("no configuration at all stays silent", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();

  await harness.start({ ui: fake.ui });

  assert.deepEqual(fake.notices, []);
});

test("a startup publish dropped before the editor is ready is retried on render", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true });
  harness.setZentuiActive(false);

  await harness.start({ ui: fake.ui });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ startup.ts");
  assert.deepEqual(variables(harness), [], "the inactive probe drops the startup value");

  harness.setZentuiActive(true);
  assert.deepEqual(fake.renderEditor(80), ["rendered 80"], "the editor's lines are untouched");
  await Promise.resolve();

  assert.deepEqual(variables(harness), [{ key: "pi-ide-status:ide", text: "⧉ ✓ startup.ts" }]);
});

test("renders coalesce into one capability probe", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true });
  harness.setZentuiActive(false);
  await harness.start({ ui: fake.ui });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ startup.ts");
  const before = probes(harness).length;

  harness.setZentuiActive(true);
  fake.renderEditor(80);
  fake.renderEditor(80);
  await Promise.resolve();

  assert.equal(probes(harness).length, before + 1);
});

test("a shutdown cancels a scheduled render refresh", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true });
  harness.setZentuiActive(false);
  await harness.start({ ui: fake.ui });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ startup.ts");

  harness.setZentuiActive(true);
  fake.renderEditor(80);
  await harness.shutdown({ ui: fake.ui });
  await Promise.resolve();

  assert.deepEqual(variables(harness), []);
});

test("a shutdown restores the editor factory it displaced", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true });
  const before = fake.currentEditorFactory();

  await harness.start({ ui: fake.ui });
  assert.notEqual(fake.currentEditorFactory(), before);

  await harness.shutdown({ ui: fake.ui });
  assert.equal(fake.currentEditorFactory(), before);
});

test("a frozen editor render is left alone and still renders", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true, frozenRender: true });
  harness.setZentuiActive(false);

  await harness.start({ ui: fake.ui });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ frozen.ts");
  harness.setZentuiActive(true);
  assert.deepEqual(fake.renderEditor(80), ["rendered 80"]);
  await Promise.resolve();
  assert.deepEqual(variables(harness), [], "a frozen render is not observed");

  fake.ui.setStatus("pi-x-ide", "⧉ ✓ events.ts");
  assert.deepEqual(variables(harness), [{ key: "pi-ide-status:ide", text: "⧉ ✓ events.ts" }]);
});

test("a render refresh reclaims a tee installed after ours", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi({ editor: true });
  await harness.start({ ui: fake.ui });

  const later = createTee(() => {});
  later.install(fake.ui);
  fake.renderEditor(80);
  await Promise.resolve();

  assert.equal(later.owns(fake.ui), false);
});

test("a ui without an editor component keeps the event-driven path", async (t) => {
  const harness = createHarness({ home: await tempHome(t) });
  const fake = createUi();

  await harness.start({ ui: fake.ui });
  fake.ui.setStatus("pi-x-ide", "⧉ ✓ events.ts");

  assert.deepEqual(variables(harness), [{ key: "pi-ide-status:ide", text: "⧉ ✓ events.ts" }]);
});
