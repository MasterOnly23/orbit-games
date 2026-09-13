const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseEaPage,
  readEaCatalog,
} = require("../electron/accounts/ea-catalog.cjs");
const game = (id, methods = ["PURCHASE"]) => ({
  id,
  originOfferId: `Origin.${id}`,
  product: {
    id: `product.${id}`,
    name: `Game ${id}`,
    gamePlatformDetails: { gamePlatform: "PC" },
    baseItem: { isLauncher: false },
    gameProductUser: {
      ownershipMethods: methods,
      entitlementId: "PRIVATE_ENTITLEMENT",
    },
  },
});
const page = (
  items,
  next = null,
  totalCount = items.length,
  id = "test-account",
) => ({ data: { me: { id, ownedGameProducts: { items, next, totalCount } } } });

test("EA stages complete pages, preserves account identity and exposes no entitlement material", async () => {
  const seen = [];
  const result = await readEaCatalog(async (cursor) => {
    seen.push(cursor);
    return cursor === "0"
      ? page([game("one")], "cursor2", 2)
      : page([game("two", ["VAULT"])], null, 2);
  });
  assert.deepEqual(seen, ["0", "cursor2"]);
  assert.equal(result.externalId, "test-account");
  assert.equal(result.games.length, 2);
  assert.ok(result.games.every((item) => item.access === "unknown"));
  assert.match(result.games[1].accessNote, /suscripción/);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_ENTITLEMENT"));
  assert.equal((await readEaCatalog(async () => page([]))).games.length, 0);
});

test("EA rejects partial GraphQL data, truncated catalogs, cursor loops and account switches", async () => {
  for (const response of [
    { ...page([]), errors: [{ message: "PRIVATE_FAILURE" }] },
    page([game("one")], null, 2),
    page([game("one"), game("one")]),
    page([], "next", 1),
    { data: { me: null } },
  ])
    await assert.rejects(
      readEaCatalog(async () => response),
      (error) =>
        error.code === "incomplete" && !error.message.includes("PRIVATE"),
    );
  for (const nextPage of [
    page([game("two")], null, 2, "other-account"),
    page([game("two")], null, 3),
    page([game("two")], "0", 2),
  ]) {
    let requests = 0;
    await assert.rejects(
      readEaCatalog(async () =>
        ++requests === 1 ? page([game("one")], "next", 2) : nextPage,
      ),
      { code: "incomplete" },
    );
    assert.ok(requests <= 2);
  }
});

test("EA excludes explicit non-PC products and launchers, labels trials and rejects malformed identities", () => {
  const mac = game("mac");
  mac.product.gamePlatformDetails.gamePlatform = "MAC";
  const launcher = game("launcher");
  launcher.product.baseItem.isLauncher = true;
  const trial = game("trial");
  trial.product.isUngatedTrial = true;
  const parsed = parseEaPage(page([mac, launcher, trial]));
  assert.equal(parsed.recordIds.length, 3);
  assert.equal(parsed.games.length, 1);
  assert.match(parsed.games[0].accessNote, /prueba/);
  const invalid = game("bad");
  invalid.originOfferId = "../../secret";
  assert.throws(() => parseEaPage(page([invalid])), { code: "incomplete" });
});

test("EA cancellation stops a pending page without returning a partial library", async () => {
  const controller = new AbortController();
  const result = readEaCatalog(() => new Promise(() => {}), {
    signal: controller.signal,
  });
  controller.abort(new Error("fixture cancelled"));
  await assert.rejects(result, /fixture cancelled/);
});
