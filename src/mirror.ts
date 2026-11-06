/**
 * The one pure seam of pi-ide-status: what the chip should show for a teed
 * statusline text, and whether that differs from what was last published.
 */

/** Zentui's custom-variable protocol limit, in UTF-16 code units. */
export const MAX_TEXT_CODE_UNITS = 256;

/** One decision: the value to hold, and whether it must be published now. */
export type Mirror = Readonly<{
  text: string | undefined;
  publish: boolean;
}>;

const SGR = /\x1b\[[0-9;:]*m/g;
const CONTROL_AND_LINE_BREAK = /\p{Cc}|\p{Zl}|\p{Zp}/gu;
const ELLIPSIS = "…";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Remove what the bus must never carry: SGR escapes and control characters. */
function clean(text: string): string {
  return text.replace(SGR, "").replace(CONTROL_AND_LINE_BREAK, "");
}

/** Cut at a grapheme boundary, leaving room for the ellipsis inside the budget. */
function cutToLimit(text: string): string {
  const budget = MAX_TEXT_CODE_UNITS - ELLIPSIS.length;
  let used = 0;
  let head = "";
  for (const { segment } of segmenter.segment(text)) {
    if (used + segment.length > budget) break;
    head += segment;
    used += segment.length;
  }
  return head + ELLIPSIS;
}

/** Fit a statusline text to the protocol limit; empty text is no text. */
function fit(text: string): string | undefined {
  const cleaned = clean(text);
  if (cleaned === "") return undefined;
  if (cleaned.length <= MAX_TEXT_CODE_UNITS) return cleaned;
  return cutToLimit(cleaned);
}

/**
 * Decide what to publish for a teed statusline text. The text is upstream's even
 * when Zentui is inactive; an inactive verdict and an undefined text both clear.
 * Only a value that differs from the last one is published.
 */
export function mirror(
  previous: string | undefined,
  raw: string | undefined,
  active: boolean,
): Mirror {
  // A text of the wrong type is nothing to do: leave the published value alone.
  if (raw !== undefined && typeof raw !== "string") return { text: previous, publish: false };
  const text = active && raw !== undefined ? fit(raw) : undefined;
  return { text, publish: text !== previous };
}
