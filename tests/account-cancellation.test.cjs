const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountService } = require("../electron/accounts/service.cjs");
const id = "11111111-1111-1111-1111-111111111111";
const credentials = { externalId: "qa", displayName: "QA" };
const catalog = {
  complete: true,
  games: [{ productId: "1", name: "Late result" }],
};

for (const operation of ["connect", "sync"])
  test(`cancelled ${operation} rejects late provider results without changing the library`, async () => {
    let release, started;
    const entered = new Promise((resolve) => {
      started = resolve;
    });
    const delayed = new Promise((resolve) => {
      release = resolve;
    });
    const store = {
      data: {
        games: [{ id: "existing", name: "Existing", favorite: true }],
        accounts:
          operation === "sync"
            ? [
                {
                  id,
                  externalId: "qa",
                  providerId: "qa",
                  provider: "QA",
                  status: "connected",
                },
              ]
            : [],
      },
    };
    const before = JSON.stringify(store.data);
    let saves = 0,
      clears = 0;
    const service = createAccountService({
      store,
      save: async () => saves++,
      readSession: async () => credentials,
      clearSession: async () => clears++,
      providers: {
        qa: {
          name: "QA",
          fetchLibrary: async (_credentials, { signal }) => {
            started();
            await delayed;
            assert.equal(signal.aborted, true);
            return catalog;
          },
        },
      },
    });
    const pending =
      operation === "connect" ? service.connect("qa") : service.sync(id);
    await entered;
    assert.equal(service.cancel(), true);
    release();
    const result = await pending;
    assert.equal(result.error.code, "cancelled");
    assert.equal(JSON.stringify(store.data), before);
    assert.equal(saves, 0);
    assert.equal(clears, operation === "connect" ? 1 : 0);
    assert.equal(service.cancel(), false);
    assert.equal(
      (await service.connect("unsupported")).error.code,
      "unsupported",
      "Operation lock must be released",
    );
  });

test("cancellation is declined once a complete catalog is being committed", async () => {
  let started, release;
  const saving = new Promise((resolve) => {
    started = resolve;
  });
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  const service = createAccountService({
    store: { data: { games: [], accounts: [] } },
    readSession: async () => credentials,
    clearSession: async () =>
      assert.fail("Committed account must retain its session"),
    save: async () => {
      started();
      await delayed;
    },
    providers: { qa: { name: "QA", fetchLibrary: async () => catalog } },
  });
  const pending = service.connect("qa");
  await saving;
  assert.equal(service.cancel(), false);
  release();
  assert.equal((await pending).ok, true);
});
