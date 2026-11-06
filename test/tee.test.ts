import assert from "node:assert/strict";
import { test } from "node:test";
import type { StatusHost } from "../src/tee.ts";
import { IDE_STATUS_KEY, createTee } from "../src/tee.ts";

type Call = readonly [key: string, text: string | undefined];

/** A host whose `setStatus` is a real, plain data property, as pi builds it. */
function host(calls: Call[] = []): StatusHost {
  return {
    setStatus(key: string, text: string | undefined): void {
      calls.push([key, text]);
    },
  };
}

test("install replaces the descriptor with this package's tee", () => {
  const target = host();
  const before = Object.getOwnPropertyDescriptor(target, "setStatus");
  const tee = createTee(() => {});

  assert.equal(tee.install(target), true);
  assert.equal(tee.owns(target), true);

  const after = Object.getOwnPropertyDescriptor(target, "setStatus");
  assert.ok(after !== undefined);
  assert.notEqual(after.value, before?.value);
  assert.equal(after.writable, true);
  assert.equal(after.configurable, true);
  assert.equal(after.enumerable, before?.enumerable);
});

test("every call is forwarded unchanged with the original receiver", () => {
  const calls: Call[] = [];
  const target = host(calls);
  const received: unknown[] = [];
  const original = target.setStatus;
  target.setStatus = function (this: unknown, key: string, text: string | undefined): void {
    received.push(this);
    Reflect.apply(original, this, [key, text]);
  };
  const tee = createTee(() => {});
  tee.install(target);

  const receiver = { marker: "receiver" };
  Reflect.apply(target.setStatus, receiver, ["pi-ide-status:ide", "x"]);
  Reflect.apply(target.setStatus, receiver, ["other", undefined]);

  assert.deepEqual(calls, [
    ["pi-ide-status:ide", "x"],
    ["other", undefined],
  ]);
  for (const value of received) assert.equal(value, receiver);
});

test("only the exact pi-x-ide key reaches the consumer", () => {
  const consumed: Array<string | undefined> = [];
  const target = host();
  const tee = createTee((text) => consumed.push(text));
  tee.install(target);

  target.setStatus(IDE_STATUS_KEY, "⧉ ✓ index.ts#L12-L15");
  target.setStatus(`${IDE_STATUS_KEY}:extra`, "⧉ ✕");
  target.setStatus("pi-vim-status:vim", "NORMAL");

  assert.deepEqual(consumed, ["⧉ ✓ index.ts#L12-L15"]);
});

test("a throwing consumer cannot stop the caller's own write", () => {
  const calls: Call[] = [];
  const target = host(calls);
  const tee = createTee(() => {
    throw new Error("consumer defect");
  });
  tee.install(target);

  assert.doesNotThrow(() => target.setStatus(IDE_STATUS_KEY, "⧉ ⠋"));
  assert.deepEqual(calls, [[IDE_STATUS_KEY, "⧉ ⠋"]]);
});

test("restore puts the predecessor's descriptor back exactly", () => {
  const target = host();
  const before = Object.getOwnPropertyDescriptor(target, "setStatus");
  const tee = createTee(() => {});
  tee.install(target);

  tee.restore(target);

  assert.deepEqual(Object.getOwnPropertyDescriptor(target, "setStatus"), before);
  assert.equal(tee.owns(target), false);
});

test("install is idempotent and restore unwinds one layer", () => {
  const target = host();
  const before = Object.getOwnPropertyDescriptor(target, "setStatus");
  const tee = createTee(() => {});

  tee.install(target);
  const once = Object.getOwnPropertyDescriptor(target, "setStatus");
  tee.install(target);
  assert.deepEqual(Object.getOwnPropertyDescriptor(target, "setStatus"), once);

  tee.restore(target);
  assert.deepEqual(Object.getOwnPropertyDescriptor(target, "setStatus"), before);
});

test("install over another tee forwards through it and restore unwinds one layer", () => {
  const calls: Call[] = [];
  const target = host(calls);
  const before = Object.getOwnPropertyDescriptor(target, "setStatus");
  const outer = createTee(() => {});

  outer.install(target);
  const inner = createTee(() => {});
  inner.install(target);

  target.setStatus(IDE_STATUS_KEY, "⧉ ✓ index.ts");
  assert.deepEqual(calls, [[IDE_STATUS_KEY, "⧉ ✓ index.ts"]]);

  inner.restore(target);
  assert.equal(outer.owns(target), true);

  outer.restore(target);
  assert.deepEqual(Object.getOwnPropertyDescriptor(target, "setStatus"), before);
});

test("ensure re-installs over a tee that displaced it, and the publish still lands", () => {
  const calls: Call[] = [];
  const consumed: Array<string | undefined> = [];
  const target = host(calls);
  const first = createTee((text) => consumed.push(text));
  first.install(target);

  const later = createTee(() => {});
  later.install(target);
  assert.equal(first.owns(target), false);

  first.ensure(target);
  assert.equal(first.owns(target), true);

  target.setStatus(IDE_STATUS_KEY, "⧉ ⇡ index.ts#L1-L4");
  assert.deepEqual(consumed, ["⧉ ⇡ index.ts#L1-L4"]);
  assert.deepEqual(calls, [[IDE_STATUS_KEY, "⧉ ⇡ index.ts#L1-L4"]]);

  first.restore(target);
  assert.equal(later.owns(target), true);
});

test("a host without a setStatus data property is nothing to do", () => {
  const accessor = {} as StatusHost;
  Object.defineProperty(accessor, "setStatus", {
    get: () => () => {},
    configurable: true,
  });
  const missing = {} as StatusHost;
  const tee = createTee(() => {});

  assert.equal(tee.install(accessor), false);
  assert.equal(tee.install(missing), false);
  assert.doesNotThrow(() => tee.restore(accessor));
  assert.doesNotThrow(() => tee.ensure(missing));
});

test("a setStatus that is not a function is nothing to do", () => {
  const target = { setStatus: "not a function" } as unknown as StatusHost;
  const tee = createTee(() => {});

  assert.equal(tee.install(target), false);
});
