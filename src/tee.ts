/**
 * The tee: a data property installed over `ctx.ui.setStatus` on the one `ui`
 * object pi hands to every extension in a bind. Every call is forwarded
 * unchanged; only calls keyed `pi-x-ide` are copied to this package's consumer.
 */

/** The key pi-x-ide writes its statusline text under. */
export const IDE_STATUS_KEY = "pi-x-ide";

/** The narrow shape the tee needs from a `ui` object. */
export type StatusHost = {
  setStatus(key: string, text: string | undefined): void;
};

/** What the tee hands a teed statusline text to. */
export type StatusConsumer = (text: string | undefined) => void;

/** Install and restore one tee. */
export interface Tee {
  /** Install over the host's own `setStatus`; false when there is nothing to install over. */
  install(host: StatusHost): boolean;
  /** Put the predecessor's descriptor back, if this tee is still the own value. */
  restore(host: StatusHost): void;
  /** Re-install when a later tee has taken the own property. */
  ensure(host: StatusHost): boolean;
  /** Whether this tee is the host's own `setStatus`. */
  owns(host: StatusHost): boolean;
}

type SetStatus = StatusHost["setStatus"];

/**
 * Build a tee around a consumer. The consumer is an argument so a test can pass
 * in one that throws and prove the caller's own write still lands. Failures in
 * the consumer are contained here, never at the call site.
 */
export function createTee(consume: StatusConsumer): Tee {
  let predecessor: PropertyDescriptor | undefined;
  let forward: SetStatus | undefined;
  /** The deepest function we displaced on our first install: the true callee. */
  let base: SetStatus | undefined;
  /** After restore this function stays reachable beneath a tee that captured it. */
  let restored = false;
  let depth = 0;

  const tee = function (this: StatusHost, key: string, text: string | undefined): void {
    const outermost = depth === 0;
    depth += 1;
    let failed = false;
    try {
      // A tee that displaced us captured us as its predecessor, so forwarding to
      // it would loop back here. On re-entry, call the function beneath us instead.
      const next = depth === 1 ? forward : base;
      if (next !== undefined) Reflect.apply(next, this, [key, text]);
    } catch (error) {
      // Our own key's failed write is nothing to do: contain it and publish nothing.
      // Any other key is forwarded unchanged, so other extensions still see their faults.
      if (key !== IDE_STATUS_KEY) throw error;
      failed = true;
    } finally {
      depth -= 1;
      if (outermost && !restored && !failed && key === IDE_STATUS_KEY) {
        try {
          consume(text);
        } catch {
          // A defect in the mirror must never stop the caller's own write.
        }
      }
    }
  };

  const owns = (host: StatusHost): boolean => {
    const descriptor = Object.getOwnPropertyDescriptor(host, "setStatus");
    return descriptor !== undefined && "value" in descriptor && descriptor.value === tee;
  };

  const install = (host: StatusHost): boolean => {
    const descriptor = Object.getOwnPropertyDescriptor(host, "setStatus");
    if (descriptor === undefined || !("value" in descriptor)) return false;
    if (descriptor.value === tee) return true;
    if (typeof descriptor.value !== "function") return false;

    const next = descriptor.value as SetStatus;
    try {
      Object.defineProperty(host, "setStatus", {
        ...descriptor,
        value: tee,
        writable: true,
        configurable: true,
      });
    } catch {
      return false;
    }
    predecessor = descriptor;
    forward = next;
    if (base === undefined) base = next;
    restored = false;
    return true;
  };

  const restore = (host: StatusHost): void => {
    if (!owns(host)) return;
    try {
      if (predecessor !== undefined) Object.defineProperty(host, "setStatus", predecessor);
    } catch {
      return;
    }
    // The predecessor may be a tee that captured us; leave it a working callee.
    forward = base;
    predecessor = undefined;
    restored = true;
  };

  const ensure = (host: StatusHost): boolean => {
    if (owns(host)) return true;
    return install(host);
  };

  return { install, restore, ensure, owns };
}
