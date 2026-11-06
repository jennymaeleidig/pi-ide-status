import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mirror } from "../src/mirror.ts";
import { MAX_TEXT_CODE_UNITS, mirror } from "../src/mirror.ts";

type Row = Readonly<{
  name: string;
  previous: string | undefined;
  raw: string | undefined;
  active: boolean;
  expected: Mirror;
}>;

const CLEAR: Mirror = { text: undefined, publish: false };

const rows: readonly Row[] = [
  {
    name: "the connecting spinner passes through verbatim",
    previous: undefined,
    raw: "⧉ ⠋",
    active: true,
    expected: { text: "⧉ ⠋", publish: true },
  },
  {
    name: "the connected marker passes through verbatim",
    previous: undefined,
    raw: "⧉ ✓",
    active: true,
    expected: { text: "⧉ ✓", publish: true },
  },
  {
    name: "a basename and line span pass through verbatim",
    previous: undefined,
    raw: "⧉ ✓ index.ts#L12-L15",
    active: true,
    expected: { text: "⧉ ✓ index.ts#L12-L15", publish: true },
  },
  {
    name: "the pending marker passes through verbatim",
    previous: undefined,
    raw: "⧉ ⇡ index.ts#L12-L15",
    active: true,
    expected: { text: "⧉ ⇡ index.ts#L12-L15", publish: true },
  },
  {
    name: "the error marker passes through verbatim",
    previous: undefined,
    raw: "⧉ ✕",
    active: true,
    expected: { text: "⧉ ✕", publish: true },
  },
  {
    name: "SGR escapes are stripped",
    previous: undefined,
    raw: "\u001b[2m⧉ ✓ index.ts\u001b[0m",
    active: true,
    expected: { text: "⧉ ✓ index.ts", publish: true },
  },
  {
    name: "control characters and line breaks are stripped",
    previous: undefined,
    raw: "⧉\u0000 ✓\r\n index.ts\u0007",
    active: true,
    expected: { text: "⧉ ✓ index.ts", publish: true },
  },
  {
    name: "a text left empty by stripping clears",
    previous: "⧉ ✓ index.ts",
    raw: "\u001b[0m\u0000\n",
    active: true,
    expected: { text: undefined, publish: true },
  },
  {
    name: "an undefined text clears",
    previous: "⧉ ✓ index.ts",
    raw: undefined,
    active: true,
    expected: { text: undefined, publish: true },
  },
  {
    name: "an undefined text with nothing published emits nothing",
    previous: undefined,
    raw: undefined,
    active: true,
    expected: CLEAR,
  },
  {
    name: "an inactive verdict clears rather than freezing",
    previous: "⧉ ✓ index.ts",
    raw: "⧉ ✓ index.ts",
    active: false,
    expected: { text: undefined, publish: true },
  },
  {
    name: "a change from active to inactive produces exactly one clear",
    previous: "⧉ ✓ index.ts",
    raw: "⧉ ✓ index.ts#L1-L2",
    active: false,
    expected: { text: undefined, publish: true },
  },
  {
    name: "an inactive verdict with nothing published emits nothing",
    previous: undefined,
    raw: "⧉ ✓ index.ts",
    active: false,
    expected: CLEAR,
  },
  {
    name: "a duplicate of the previously published value emits nothing",
    previous: "⧉ ✓ index.ts",
    raw: "⧉ ✓ index.ts",
    active: true,
    expected: { text: "⧉ ✓ index.ts", publish: false },
  },
  {
    name: "a duplicate after SGR stripping emits nothing",
    previous: "⧉ ✓ index.ts",
    raw: "\u001b[2m⧉ ✓ index.ts\u001b[0m",
    active: true,
    expected: { text: "⧉ ✓ index.ts", publish: false },
  },
];

for (const row of rows) {
  test(row.name, () => {
    assert.deepEqual(mirror(row.previous, row.raw, row.active), row.expected);
  });
}

test("a statusline text of the wrong type is nothing to do", () => {
  const previous = "⧉ ✓ index.ts";
  assert.deepEqual(mirror(previous, 42 as unknown as string, true), {
    text: previous,
    publish: false,
  });
});

test("an over-limit text is fitted to the protocol limit with the ellipsis inside the budget", () => {
  const result = mirror(undefined, "a".repeat(300), true);
  const expected = `${"a".repeat(MAX_TEXT_CODE_UNITS - 1)}…`;
  assert.equal(result.text, expected);
  assert.equal(expected.length, MAX_TEXT_CODE_UNITS);
  assert.equal(result.publish, true);
});

test("fitting a multi-byte text cuts at a grapheme boundary with no unpaired surrogate", () => {
  const result = mirror(undefined, "😀".repeat(200), true);
  assert.equal(result.text, `${"😀".repeat(127)}…`);
  assert.ok(result.text !== undefined);
  assert.ok(result.text.length <= MAX_TEXT_CODE_UNITS);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result.text));
  assert.ok(!/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result.text));
});

test("fitting keeps combining marks attached to their base character", () => {
  const result = mirror(undefined, "e\u0301".repeat(200), true);
  assert.equal(result.text, `${"e\u0301".repeat(127)}…`);
});

test("text at the limit is untouched", () => {
  const text = "a".repeat(MAX_TEXT_CODE_UNITS);
  assert.deepEqual(mirror(undefined, text, true), { text, publish: true });
});
