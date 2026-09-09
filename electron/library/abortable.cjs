// Stops waiting for a read-only operation if its API cannot cancel underlying I/O.
// The operation's eventual rejection is still observed, and its result discarded.
async function abortable(work, signal) {
  signal?.throwIfAborted();
  if (!signal) return work();
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return work();
      }),
      cancelled,
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
module.exports = { abortable };
