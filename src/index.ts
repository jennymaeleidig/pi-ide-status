import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Scaffolding only: reads `pi-x-ide`'s status and republishes it on Zentui's
 * custom-variable bus, with Pi's extension status channel as the fallback.
 * Behaviour is unspecified until the design is settled.
 */
export default function piIdeStatus(_pi: ExtensionAPI): void {}
