const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  battleNetTitleId,
} = require("../electron/library/battlenet-identity.cjs");
const { scanBattleNet } = require("../electron/library/battlenet-local.cjs");
const { mergeGames } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
} = require("../electron/library/account-library.cjs");
const uninstall = (uid) =>
  `"C:\\Battle.net\\Battle.net.exe" --exec=uninstall --uid=${uid}`;

test("Battle.net identity requires one exact UID and excludes ambiguous mappings and test variants", () => {
  assert.equal(
    battleNetTitleId({ UninstallString: uninstall('"DIABLO3"') }),
    "title:17459",
  );
  for (const uid of [
    "diablo3_beta",
    "auks",
    "pinta",
    "unknown",
    "diablo3 --uid=s2",
    "diablo3/extra",
  ])
    assert.equal(
      battleNetTitleId({ UninstallString: uninstall(uid) }),
      undefined,
    );
  assert.equal(
    battleNetTitleId({
      UninstallString: uninstall("diablo3"),
      DisplayName: "Diablo III PTR",
    }),
    undefined,
  );
  assert.equal(
    battleNetTitleId({ UninstallString: "Other.exe --uid=diablo3" }),
    undefined,
  );
});

test("Battle.net exact identity joins local and remote catalogs in either order despite different names", async () => {
  const directory = path.resolve("fixture-diablo");
  const { games } = await scanBattleNet({
    inventory: {
      uninstall: [
        {
          DisplayName: "Different localized installation name",
          Publisher: "Blizzard Entertainment",
          PSChildName: "fixture-diablo",
          InstallLocation: directory,
          DisplayIcon: path.join(directory, "Game.exe"),
          UninstallString: uninstall("diablo3"),
        },
      ],
    },
    availability: async () => ({ status: "installed" }),
  });
  assert.equal(games[0].providerId, "title:17459");
  const account = { id: "account", provider: "Battle.net" };
  const catalog = {
    complete: true,
    games: [
      { productId: "title:17459", name: "Diablo III", access: "unknown" },
    ],
  };
  const localFirst = mergeAccountLibrary(
    [{ ...games[0], favorite: true, notes: "Keep local notes" }],
    account,
    catalog,
  );
  assert.equal(localFirst.length, 1);
  assert.equal(localFirst[0].notes, "Keep local notes");
  assert.equal(localFirst[0].status, "installed");
  const remote = mergeAccountLibrary([], account, catalog);
  remote[0].notes = "Keep remote notes";
  remote[0].tags = ["Personal"];
  const remoteFirst = mergeGames(games, remote);
  assert.equal(remoteFirst.length, 1);
  assert.equal(remoteFirst[0].id, remote[0].id);
  assert.equal(remoteFirst[0].notes, "Keep remote notes");
  assert.deepEqual(remoteFirst[0].tags, ["Personal"]);
  assert.equal(remoteFirst[0].status, "installed");
  assert.equal(remoteFirst[0].accountEntitlements.length, 1);
  assert.equal(
    mergeGames([{ ...games[0], providerId: "title:999" }], remote).length,
    2,
  );
});
