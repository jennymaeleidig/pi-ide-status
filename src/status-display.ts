/**
 * Resolve pi-x-ide's own `status_display` setting, which decides whether it
 * writes a statusline text for this package to mirror at all.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The two placements pi-x-ide understands. */
export type StatusDisplay = "widget" | "statusline";

/** The roots the resolver reads, passed in so tests need not touch the environment. */
export type Locations = Readonly<{ home: string; cwd: string }>;

function configPath(root: string): string {
  return resolve(root, ".pi", "pi-x-ide", "config.json");
}

/** Read one configuration file's recognised `status_display`, if it has one. */
function read(path: string): StatusDisplay | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const value = (parsed as { status_display?: unknown }).status_display;
  return value === "widget" || value === "statusline" ? value : undefined;
}

/**
 * The effective display mode: the project configuration overrides the global
 * one, and an absent or unrecognised configuration resolves to nothing rather
 * than to upstream's default, so this package can stay silent about a setting
 * the user never made.
 */
export function resolveStatusDisplay({ home, cwd }: Locations): StatusDisplay | undefined {
  return read(configPath(cwd)) ?? read(configPath(home));
}
