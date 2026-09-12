const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseGameAccounts,
  fetchBattleNetCatalog,
} = require("../electron/accounts/battlenet-catalog.cjs");
const entry = {
  titleId: 123,
  localizedGameName: "Fixture game",
  gameAccountName: "PRIVATE_NAME",
  gameAccountUniqueId: { gameAccountId: 999 },
  gameAccountStatus: "PRIVATE_STATUS",
  titleHasSubscriptions: true,
};
const json = (value) => new Response(JSON.stringify(value));

test("Battle.net game account records do not become purchases and drop private fields", () => {
  const games = parseGameAccounts({
    gameAccounts: [entry, { ...entry, gameAccountRegion: "EU" }],
  });
  assert.equal(games.length, 1);
  assert.equal(games[0].access, "unknown");
  assert.deepEqual(Object.keys(games[0]).sort(), [
    "access",
    "accessNote",
    "name",
    "productId",
  ]);
  assert.ok(!JSON.stringify(games).includes("PRIVATE"));
  for (const data of [
    {},
    { gameAccounts: null },
    { gameAccounts: [{ ...entry, titleId: 0 }] },
    {
      gameAccounts: [
        entry,
        { ...entry, localizedGameName: "Conflicting title" },
      ],
    },
  ])
    assert.throws(() => parseGameAccounts(data));
});

test("Battle.net catalog requires both responses and refuses unverified classic identities without leaking keys", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "error");
    return json(
      url.endsWith("classic-games")
        ? { classicGames: [] }
        : { gameAccounts: [entry] },
    );
  };
  const catalog = await fetchBattleNetCatalog({ fetchImpl });
  assert.equal(catalog.complete, true);
  assert.equal(catalog.games.length, 1);
  assert.equal(calls.length, 2);
  await assert.rejects(
    fetchBattleNetCatalog({
      fetchImpl: async (url) =>
        json(
          url.endsWith("classic-games")
            ? {
                classicGames: [
                  { localizedGameName: "Classic", cdKeys: ["PRIVATE_KEY"] },
                ],
              }
            : { gameAccounts: [entry] },
        ),
    }),
    (error) =>
      error.code === "unsupported-catalog" &&
      !error.message.includes("PRIVATE"),
  );
  await assert.rejects(
    fetchBattleNetCatalog({
      fetchImpl: async (url) =>
        json(url.endsWith("classic-games") ? {} : { gameAccounts: [entry] }),
    }),
    { code: "incomplete" },
  );
});

test("Battle.net errors, response size and cancellation are bounded and sanitized", async () => {
  for (const [status, code] of [
    [401, "auth-required"],
    [429, "rate-limit"],
    [500, "unavailable"],
  ])
    await assert.rejects(
      fetchBattleNetCatalog({
        fetchImpl: async () => new Response("PRIVATE", { status }),
      }),
      { code },
    );
  await assert.rejects(
    fetchBattleNetCatalog({
      fetchImpl: async () => new Response("PRIVATE_NOT_JSON"),
    }),
    (error) => error.code === "network" && !error.message.includes("PRIVATE"),
  );
  await assert.rejects(
    fetchBattleNetCatalog({
      fetchImpl: async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1)),
    }),
    { code: "incomplete" },
  );
  const controller = new AbortController();
  let started;
  const pending = new Promise((resolve) => {
    started = resolve;
  });
  const work = fetchBattleNetCatalog({
    signal: controller.signal,
    fetchImpl: () => {
      started();
      return new Promise(() => {});
    },
  });
  const rejected = assert.rejects(work, { code: "cancelled" });
  await pending;
  controller.abort();
  await rejected;
});
