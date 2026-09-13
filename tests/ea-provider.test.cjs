const test = require("node:test");
const assert = require("node:assert/strict");
const { ea } = require("../electron/accounts/ea.cjs");

test("EA prepared login validates account before exposing catalog and never returns bearer", async () => {
  let listener,
    detached = 0,
    navigations = [];
  const controller = new AbortController();
  const isolated = {
    webRequest: {
      onBeforeSendHeaders: (_filter, callback) => {
        listener = callback;
        if (!callback) detached++;
      },
    },
    fetch: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer SYNTHETIC_ONLY");
      return Response.json({
        data: {
          me: {
            id: "fixture",
            ownedGameProducts: { items: [], next: null, totalCount: 0 },
          },
        },
      });
    },
  };
  const prepared = ea.prepareSession({
    isolated,
    signal: controller.signal,
    webContents: {
      id: 14,
      getURL: () => "https://www.ea.com/",
      loadURL: async (url) => navigations.push(url),
    },
  });
  assert.equal(await prepared.readSession(), null);
  assert.equal(await prepared.readSession(), null);
  assert.deepEqual(navigations, ["https://www.ea.com/sales/deals"]);
  listener(
    {
      url: "https://service-aggregation-layer.juno.ea.com/graphql",
      webContentsId: 14,
      requestHeaders: { Authorization: "Bearer SYNTHETIC_ONLY" },
    },
    () => {},
  );
  const value = await prepared.readSession();
  assert.equal(ea.validSession(value), true);
  assert.ok(!JSON.stringify(value).includes("SYNTHETIC_ONLY"));
  assert.deepEqual(await ea.fetchLibrary(value), { complete: true, games: [] });
  controller.abort();
  prepared.dispose();
  assert.equal(detached, 1);
  await assert.rejects(
    ea.fetchLibrary({ externalId: "changed", catalog: value.catalog }),
    { code: "auth-required" },
  );
});
