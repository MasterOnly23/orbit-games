const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyUri,
  validLaunchUri,
  mergeGames,
} = require("../electron/library/model.cjs");
const { scanShortcuts } = require("../electron/library/windows-shortcuts.cjs");

test("EA accepts current content launch links and legacy dotted IDs without claiming account identity", () => {
  for (const uri of [
    "origin2://game/launch/?offerIds=content-123",
    "origin2://game/launch/?offerIds=Origin.OFR.50.123",
    "origin://launchgame/Origin.OFR.50.123",
    "origin2://launchgame/123?Title=Example",
  ]) {
    assert.equal(validLaunchUri(uri), true);
    assert.equal(classifyUri(uri).provider, "EA app");
    assert.equal(classifyUri(uri).providerId, undefined);
    assert.ok(classifyUri(uri).eaLaunchId);
  }
  for (const uri of [
    "origin2://game/launch/?offerIds=a&offerIds=b",
    "origin2://game/launch/?offerIds=a,b",
    "origin2://game/launch/?offerIds=../secret",
    "origin2://game/launch/?offerIds=a&extra=b",
    "origin2://user@game/launch/?offerIds=a",
    "origin2://game:123/launch/?offerIds=a",
    "origin2://game/launch/?offerIds=%ZZ",
    "origin2://game/launch/?offerIds=a#fragment",
    "origin://launchgame/../a",
    "origin2://game/launch/?offerIds=a%0Ab",
  ])
    assert.equal(validLaunchUri(uri), false, uri);
});

test("EA current shortcut is retained as unverified installation and keeps its content ID separate", async () => {
  const uri = "origin2://game/launch/?offerIds=content-123";
  const result = await scanShortcuts({
    inventory: {
      shortcuts: [
        { name: "Fixture", path: "C:\\Games\\Fixture.url", url: uri },
      ],
      startApps: [],
      packages: [],
    },
    steam: { byAppId: new Map(), missingLibraries: [] },
    epic: { byAppName: new Map() },
    riot: { games: [] },
    io: { exists: async () => false },
  });
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].status, "unknown");
  assert.equal(result.games[0].eaLaunchId, "content-123");
  assert.equal(result.games[0].providerId, undefined);
  assert.equal(result.games[0].launch.target, uri);
});

test("EA shortcuts with the same title but different content IDs stay separate", () => {
  const local = (id) => ({
    id,
    name: "Same title",
    provider: "EA app",
    eaLaunchId: id,
    sources: [id],
    status: "unknown",
  });
  assert.equal(mergeGames([local("one"), local("two")]).length, 2);
});

test("EA account offers do not absorb same-title local games without an explicit offer mapping", () => {
  const {
    mergeAccountLibrary,
  } = require("../electron/library/account-library.cjs");
  const account = { id: "ea-account", provider: "EA app" };
  const catalog = {
    complete: true,
    games: [
      { productId: "Origin.offer", name: "Same title", access: "unknown" },
    ],
  };
  const remote = mergeAccountLibrary([], account, catalog);
  remote[0].notes = "Account notes";
  remote[0].favorite = true;
  for (const eaLaunchId of [undefined, "different-content", "Origin.offer"]) {
    const local = {
      id: "local",
      provider: "EA app",
      name: "Same title",
      eaLaunchId,
      sources: ["fixture.url"],
      status: "installed",
      launch: { kind: "file", target: "fixture.exe" },
    };
    const merged = mergeGames([local], remote);
    assert.equal(
      merged.length,
      2,
      "Name or equal text in different ID namespaces does not prove identity",
    );
    const retained = merged.find((game) => game.id === remote[0].id);
    assert.equal(retained.notes, "Account notes");
    assert.equal(retained.favorite, true);
    assert.equal(retained.status, "uninstalled");
    assert.equal(
      merged.find((game) => game.id === "local").accountEntitlements.length,
      0,
    );
    assert.equal(mergeAccountLibrary([local], account, catalog).length, 2);
  }
});
