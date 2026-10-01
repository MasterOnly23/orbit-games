const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeGames } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
} = require("../electron/library/account-library.cjs");
const { withEaOfferIdentity } = require("../electron/library/ea-identity.cjs");

const account = { id: "ea-account", provider: "EA app" };
const snapshot = {
  complete: true,
  games: [
    {
      productId: "Origin.offer",
      eaContentId: "content-123",
      name: "Remote title",
      access: "unknown",
    },
  ],
};
const local = () => ({
  id: "local",
  provider: "EA app",
  name: "Título local",
  eaLaunchId: "content-123",
  sources: ["fixture.url"],
  status: "unknown",
  launch: {
    kind: "uri",
    target: "origin2://game/launch/?offerIds=content-123",
  },
});
const personalize = (game) =>
  Object.assign(game, {
    notes: "Keep notes",
    favorite: true,
    tags: ["Coop"],
    customName: "My title",
    artworkRevision: 100,
    artworkFile: "covers/local.webp",
  });

for (const order of ["local-first", "account-first"]) {
  test(`EA explicit mapping merges ${order} despite translated names and retains personal data`, () => {
    const previous =
      order === "local-first"
        ? [local()]
        : mergeAccountLibrary([], account, snapshot);
    personalize(previous[0]);
    const before = JSON.stringify(previous);
    const merged =
      order === "local-first"
        ? mergeAccountLibrary(previous, account, snapshot)
        : mergeGames([local()], previous);
    assert.equal(
      JSON.stringify(previous),
      before,
      "merge must not mutate previous state",
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, previous[0].id);
    assert.equal(merged[0].providerId, "Origin.offer");
    assert.equal(merged[0].eaContentId, "content-123");
    assert.equal(merged[0].status, "unknown");
    assert.deepEqual(merged[0].launch, local().launch);
    assert.equal(merged[0].notes, "Keep notes");
    assert.equal(merged[0].favorite, true);
    assert.deepEqual(merged[0].tags, ["Coop"]);
    assert.equal(merged[0].customName, "My title");
    assert.equal(merged[0].artworkRevision, 100);
    assert.equal(merged[0].artworkFile, "covers/local.webp");
    assert.equal(merged[0].accountEntitlements[0].productId, "Origin.offer");
    assert.equal(merged[0].accountEntitlements[0].kind, "unknown");
    assert.equal(merged[0].accountEntitlements[0].state, "available");
    assert.deepEqual(merged[0].sources, local().sources);
    assert.equal(
      mergeGames([local()], merged).length,
      1,
      "repeat scan remains joined",
    );
    assert.equal(
      mergeAccountLibrary(merged, account, snapshot).length,
      1,
      "repeat sync remains joined",
    );
  });
}

test("EA mappings do not join ambiguous offers across accounts or change manual entries", () => {
  const remote = mergeAccountLibrary([], account, snapshot);
  const second = {
    ...snapshot,
    games: [{ ...snapshot.games[0], productId: "Other.offer" }],
  };
  const both = mergeAccountLibrary(
    remote,
    { ...account, id: "second-account" },
    second,
  );
  assert.equal(mergeGames([local()], both).length, 3);
  assert.equal(
    mergeAccountLibrary(
      [...remote, local()],
      { ...account, id: "second-account" },
      second,
    ).length,
    3,
  );
  const manual = { ...local(), manual: true };
  assert.equal(mergeAccountLibrary([manual], account, snapshot).length, 2);
  assert.deepEqual(withEaOfferIdentity([manual], remote), [manual]);
  assert.deepEqual(
    withEaOfferIdentity([local()], [...both, ...remote]),
    [local()],
    "later duplicate must not resolve ambiguity",
  );
});

test("EA refresh cannot reuse a withdrawn mapping to attach a local game", () => {
  const remote = mergeAccountLibrary([], account, snapshot);
  const withoutMapping = {
    complete: true,
    games: [
      { productId: "Origin.offer", name: "Remote title", access: "unknown" },
    ],
  };
  const merged = mergeAccountLibrary(
    [...remote, local()],
    account,
    withoutMapping,
  );
  assert.equal(merged.length, 2);
  assert.equal(
    merged.find((game) => game.id === "local").providerId,
    undefined,
  );
  assert.equal(
    merged.find((game) => game.providerId === "Origin.offer").eaContentId,
    undefined,
  );
});

test("syncing another provider does not enrich separate EA records", () => {
  const remote = mergeAccountLibrary([], account, snapshot);
  const localGame = local();
  const previous = [...remote, localGame];
  const steam = mergeAccountLibrary(
    previous,
    { id: "steam-account", provider: "Steam" },
    {
      complete: true,
      games: [{ productId: "42", name: "Steam game", access: "unknown" }],
    },
  );

  assert.equal(steam.length, 3);
  assert.equal(steam.find((game) => game.id === "local").providerId, undefined);
  assert.equal(
    steam.find((game) => game.providerId === "Origin.offer").eaContentId,
    "content-123",
  );
  assert.equal(
    previous.find((game) => game.id === "local").providerId,
    undefined,
  );
});
