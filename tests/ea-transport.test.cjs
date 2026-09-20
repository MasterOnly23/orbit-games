const test = require("node:test");
const assert = require("node:assert/strict");
const {
  catalogUrl,
  requestEaPage,
  fetchEaCatalog,
  fetchEaOfferMapping,
} = require("../electron/accounts/ea-transport.cjs");
const token = "SYNTHETIC-SECRET";
const empty = {
  data: {
    me: {
      id: "fixture",
      ownedGameProducts: { next: null, totalCount: 0, items: [] },
    },
  },
};

test("EA transport fixes origin, isolates bearer header and connects to catalog validation", async () => {
  const result = await fetchEaCatalog({
    token,
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      assert.equal(
        parsed.origin,
        "https://service-aggregation-layer.juno.ea.com",
      );
      assert.ok(!url.includes(token));
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      assert.equal(options.redirect, "error");
      assert.equal(options.credentials, "omit");
      assert.equal(options.cache, "no-store");
      return new Response(JSON.stringify(empty));
    },
  });
  assert.deepEqual(result, { externalId: "fixture", games: [] });
  const url = new URL(catalogUrl("https://untrusted.example/?a=b&c=d"));
  assert.equal(url.hostname, "service-aggregation-layer.juno.ea.com");
  assert.equal(
    JSON.parse(url.searchParams.get("variables")).next,
    "https://untrusted.example/?a=b&c=d",
  );
});

test("EA offer mapping transport batches POST requests without account authorization or executable fields", async () => {
  const offers = Array.from({ length: 101 }, (_, index) => `offer${index}`);
  const calls = [];
  const mapping = await fetchEaOfferMapping({
    offerIds: offers,
    fetchImpl: async (url, options) => {
      assert.equal(
        url,
        "https://service-aggregation-layer.juno.ea.com/graphql",
      );
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      const body = JSON.parse(options.body);
      assert.equal(body.operationName, "getLegacyCatalogDefs");
      assert.ok(!body.query.includes("executePath"));
      calls.push(body.variables.offerIds.length);
      return Response.json({
        data: {
          legacyOffers: body.variables.offerIds.map((offerId) => ({
            offerId,
            contentId: `content.${offerId}`,
          })),
        },
      });
    },
  });
  assert.deepEqual(calls, [100, 1]);
  assert.equal(mapping.length, 101);
  await assert.rejects(
    fetchEaOfferMapping({
      offerIds: ["offer"],
      fetchImpl: async () => Response.json({ data: { legacyOffers: [] } }),
    }),
    { code: "incomplete" },
  );
});

test("EA transport neutralizes HTTP, parsing and connection failures", async () => {
  for (const [status, code] of [
    [401, "auth-required"],
    [403, "auth-required"],
    [429, "rate-limit"],
    [500, "unavailable"],
    [302, "unavailable"],
  ]) {
    await assert.rejects(
      requestEaPage({
        token,
        next: "0",
        fetchImpl: async () => new Response(token, { status }),
      }),
      (error) => error.code === code && !error.message.includes(token),
    );
  }
  for (const fetchImpl of [
    async () => new Response(token),
    async () => {
      throw new Error(token);
    },
  ])
    await assert.rejects(
      requestEaPage({ token, next: "0", fetchImpl }),
      (error) => error.code === "network" && !error.message.includes(token),
    );
  await assert.rejects(
    requestEaPage({
      token: "bad\r\nheader",
      next: "0",
      fetchImpl: () => assert.fail("no request"),
    }),
    { code: "auth-required" },
  );
});

test("EA transport bounds streaming bodies and cancels readers on oversized responses", async () => {
  let cancelled = false;
  const response = {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => ({
          done: false,
          value: new Uint8Array(8 * 1024 * 1024 + 1),
        }),
        cancel: async () => {
          cancelled = true;
        },
      }),
    },
  };
  await assert.rejects(
    requestEaPage({ token, next: "0", fetchImpl: async () => response }),
    { code: "incomplete" },
  );
  assert.equal(cancelled, true);
});

test("EA transport timeout and cancellation interrupt non-cooperative reads", async () => {
  const controller = new AbortController();
  const never = () => new Promise(() => {});
  const task = requestEaPage({
    token,
    next: "0",
    fetchImpl: never,
    signal: controller.signal,
  });
  controller.abort(new Error(token));
  await assert.rejects(
    task,
    (error) => error.code === "cancelled" && !error.message.includes(token),
  );
  const keepAlive = setInterval(() => {}, 100);
  try {
    let cancelled = false;
    await assert.rejects(
      requestEaPage({
        token,
        next: "0",
        timeoutMs: 10,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: never,
              cancel: async () => {
                cancelled = true;
              },
            }),
          },
        }),
      }),
      { code: "network" },
    );
    assert.equal(cancelled, true);
  } finally {
    clearInterval(keepAlive);
  }
});
