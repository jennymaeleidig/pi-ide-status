import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveStatusDisplay } from "../src/status-display.ts";
import { writePiXIdeConfig, writePiXIdeConfigText } from "./helpers.ts";

async function roots(t: TestContext): Promise<{ home: string; cwd: string }> {
  const directory = await mkdtemp(join(tmpdir(), "pi-ide-status-config-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const home = join(directory, "home");
  const cwd = join(directory, "project");
  await mkdir(home, { recursive: true });
  await mkdir(cwd, { recursive: true });
  return { home, cwd };
}

test("an absent configuration resolves to nothing, not to upstream's default", async (t) => {
  const { home, cwd } = await roots(t);
  assert.equal(resolveStatusDisplay({ home, cwd }), undefined);
});

test("a global statusline resolves to statusline", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "statusline");
  assert.equal(resolveStatusDisplay({ home, cwd }), "statusline");
});

test("a global widget resolves to widget", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "widget");
  assert.equal(resolveStatusDisplay({ home, cwd }), "widget");
});

test("the project configuration overrides the global one", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "widget");
  await writePiXIdeConfig(cwd, "statusline");
  assert.equal(resolveStatusDisplay({ home, cwd }), "statusline");
});

test("a project widget overrides a global statusline", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "statusline");
  await writePiXIdeConfig(cwd, "widget");
  assert.equal(resolveStatusDisplay({ home, cwd }), "widget");
});

test("a project configuration without the key falls through to the global one", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "statusline");
  await writePiXIdeConfig(cwd, undefined);
  assert.equal(resolveStatusDisplay({ home, cwd }), "statusline");
});

test("an unrecognised value falls through rather than being reported", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "statusline");
  await writePiXIdeConfig(cwd, "sidebar");
  assert.equal(resolveStatusDisplay({ home, cwd }), "statusline");
});

test("a configuration naming no recognised value resolves to nothing", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfig(home, "sidebar");
  assert.equal(resolveStatusDisplay({ home, cwd }), undefined);
});

test("an unreadable or malformed configuration resolves to nothing", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfigText(home, "{ not json");
  assert.equal(resolveStatusDisplay({ home, cwd }), undefined);
});

test("an unreadable configuration resolves to nothing", async (t) => {
  const { home, cwd } = await roots(t);
  // A directory at the config path makes readFileSync throw.
  await mkdir(join(home, ".pi", "pi-x-ide", "config.json"), { recursive: true });
  assert.equal(resolveStatusDisplay({ home, cwd }), undefined);
});

test("a configuration whose status_display is not a string resolves to nothing", async (t) => {
  const { home, cwd } = await roots(t);
  await writePiXIdeConfigText(home, JSON.stringify({ status_display: 1 }));
  assert.equal(resolveStatusDisplay({ home, cwd }), undefined);
});
