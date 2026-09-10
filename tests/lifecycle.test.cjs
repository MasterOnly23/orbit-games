const test = require("node:test");
const assert = require("node:assert/strict");
const { createLifecycle } = require("../electron/lifecycle.cjs");
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { resolve, promise };
};

test("shutdown cancels reads, waits for in-flight work, then flushes; new work is refused", async () => {
  const lifecycle = createLifecycle(),
    held = deferred(),
    started = deferred();
  const events = [];
  const work = lifecycle.run(async () => {
    started.resolve();
    await held.promise;
    events.push("saved");
  });
  await started.promise;
  const shutdown = lifecycle.drain(
    () => events.push("cancel"),
    async () => events.push("flush"),
  );
  await assert.rejects(
    lifecycle.run(() => assert.fail("must not run")),
    /cerrando/,
  );
  assert.deepEqual(events, ["cancel"]);
  held.resolve();
  await Promise.all([work, shutdown]);
  assert.deepEqual(events, ["cancel", "saved", "flush"]);
});

test("shutdown observes rejected operations and surfaces a failed flush; resume permits retry", async () => {
  const lifecycle = createLifecycle(),
    held = deferred(),
    started = deferred();
  const work = lifecycle.run(async () => {
    started.resolve();
    await held.promise;
    throw new Error("cancelled read");
  });
  const rejected = assert.rejects(work, /cancelled read/);
  await started.promise;
  const shutdown = lifecycle.drain(
    () => held.resolve(),
    async () => {
      throw new Error("disk full");
    },
  );
  await assert.rejects(shutdown, /disk full/);
  await rejected;
  lifecycle.resume();
  assert.equal(await lifecycle.run(() => "saved retry"), "saved retry");
});

test("work queued immediately before shutdown cannot begin after cancellation", async () => {
  const lifecycle = createLifecycle();
  const work = lifecycle.run(() => assert.fail("late work"));
  const rejected = assert.rejects(work, /cerrando/);
  await lifecycle.drain(
    () => {},
    async () => {},
  );
  await rejected;
});
