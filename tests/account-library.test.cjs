const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  mergeAccountLibrary,
  disconnectAccountLibrary,
} = require("../electron/library/account-library.cjs");
const { mergeGames } = require("../electron/library/model.cjs");
const account = { id: "account-a", provider: "Steam" };
const catalog = {
  complete: true,
  games: [
    {
      productId: "42",
      name: "Adventure",
      access: "owned",
      launch: { kind: "uri", target: "steam://rungameid/42" },
    },
  ],
};

test("account import attaches access without replacing local installation or personal artwork", () => {
  const local = {
    id: "local-id",
    provider: "Steam",
    steamId: "42",
    name: "Adventure",
    sources: ["manifest"],
    status: "installed",
    favorite: true,
    notes: "keep",
    artworkRevision: 100,
    customName: "Mine",
  };
  const merged = mergeAccountLibrary([local], account, catalog);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "local-id");
  assert.equal(merged[0].status, "installed");
  assert.equal(merged[0].artworkRevision, 100);
  assert.equal(merged[0].customName, "Mine");
  assert.equal(merged[0].accountEntitlements[0].kind, "owned");
  const rescanned = mergeGames(
    [{ ...local, favorite: false, artworkRevision: null }],
    merged,
  );
  assert.equal(rescanned[0].favorite, true);
  assert.equal(rescanned[0].accountEntitlements.length, 1);
});

test("remote libraries survive empty local scans, account disconnect and missing remote entries", () => {
  const imported = mergeAccountLibrary([], account, catalog);
  assert.equal(mergeGames([], imported)[0].status, "uninstalled");
  const missing = mergeAccountLibrary(imported, account, {
    complete: true,
    games: [],
  });
  assert.equal(missing.length, 1);
  assert.equal(missing[0].accountEntitlements[0].state, "not-seen");
  assert.equal(
    disconnectAccountLibrary(imported, account.id)[0].accountEntitlements[0]
      .state,
    "disconnected",
  );
  assert.equal(imported[0].accountEntitlements[0].state, "available");
  assert.throws(
    () => mergeAccountLibrary(imported, account, { games: [] }),
    /completa/,
  );
  assert.throws(
    () =>
      mergeAccountLibrary(imported, account, {
        complete: true,
        games: [...catalog.games, ...catalog.games],
      }),
    /duplicados/,
  );
});

test("two accounts share a store entry but different products and stores remain separate", () => {
  const first = mergeAccountLibrary([], account, catalog);
  const second = mergeAccountLibrary(
    first,
    { ...account, id: "account-b" },
    catalog,
  );
  assert.equal(second.length, 1);
  assert.equal(second[0].accountEntitlements.length, 2);
  const edition = mergeAccountLibrary(second, account, {
    complete: true,
    games: [{ ...catalog.games[0], productId: "43" }],
  });
  assert.equal(edition.length, 2);
  const otherStore = mergeAccountLibrary(
    edition,
    { id: "epic-a", provider: "Epic Games" },
    catalog,
  );
  assert.equal(otherStore.length, 3);
  const detected = ["42", "43"].map((providerId) => ({
    id: providerId,
    provider: "Steam",
    providerId,
    name: "Adventure",
    sources: [providerId],
    status: "installed",
  }));
  assert.equal(mergeGames(detected, edition).length, 2);
});
