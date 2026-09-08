const test = require("node:test");
const assert = require("node:assert/strict");
const { humble, parseOrders } = require("../electron/accounts/humble.cjs");
const order = {
  subproducts: [
    {
      machine_name: "game",
      human_name: "Game",
      downloads: [{ platform: "windows" }],
      private_url: "PRIVATE_DOWNLOAD",
    },
    {
      machine_name: "book",
      human_name: "Book",
      downloads: [{ platform: "ebook" }],
    },
  ],
  tpkd_dict: {
    all_tpks: [
      {
        machine_name: "game",
        human_name: "Game",
        key_type: "steam",
        redeemed_key: "PRIVATE_ACTIVATION",
      },
    ],
  },
  email: "private@example.test",
};
test("Humble distinguishes Windows downloads from unverified store keys and drops private fields", () => {
  const games = parseOrders({ private_order: order }, ["private_order"]);
  assert.equal(games.length, 2);
  assert.notEqual(games[0].productId, games[1].productId);
  assert.match(games[1].accessNote, /canje no verificado/);
  assert.ok(!JSON.stringify(games).includes("PRIVATE"));
  assert.ok(!JSON.stringify(games).includes("private@example"));
  assert.throws(() => parseOrders({}, ["missing"]));
  assert.throws(() => parseOrders({ missing: null }, ["missing"]));
});
test("Humble fetches all batches, deduplicates products and preserves the catalog on a missing order", async () => {
  const credentials = {
    orderKeys: Array.from({ length: 41 }, (_, i) => `order${i}`),
  };
  let requests = 0;
  const catalog = await humble.fetchLibrary(credentials, {
    fetchImpl: async (address) => {
      requests++;
      const keys = new URL(address).searchParams.getAll("gamekeys");
      return new Response(
        JSON.stringify(Object.fromEntries(keys.map((key) => [key, order]))),
      );
    },
  });
  assert.equal(requests, 2);
  assert.equal(catalog.games.length, 2);
  await assert.rejects(
    humble.fetchLibrary(credentials, {
      fetchImpl: async () => new Response("{}"),
    }),
    (error) => error.code === "incomplete",
  );
  await assert.rejects(
    humble.fetchLibrary(credentials, {
      fetchImpl: async () => {
        throw new Error("PRIVATE_ACTIVATION");
      },
    }),
    (error) => error.code === "network" && !error.message.includes("PRIVATE"),
  );
  assert.deepEqual(
    await humble.fetchLibrary(
      { orderKeys: [] },
      { fetchImpl: async () => assert.fail("No request needed") },
    ),
    { complete: true, games: [] },
  );
});
