import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Scaffolding only: tees `pi-x-ide`'s statusline text and mirrors it onto Zentui's
 * custom-variable bus, so the IDE's open file and line range appear beside the Vim
 * mode chip. Behaviour is specified in docs/spec.md.
 */
export default function piIdeStatus(_pi: ExtensionAPI): void {}
