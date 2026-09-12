const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { scanBattleNet } = require("../electron/library/battlenet-local.cjs");
const { scanShortcuts } = require("../electron/library/windows-shortcuts.cjs");
const root = path.resolve("fixture-games", "Diablo");
const record = (patch = {}) => ({
  DisplayName: "Diablo fixture",
  Publisher: "Blizzard Entertainment",
  InstallLocation: root,
  PSChildName: "diablo-fixture",
  DisplayIcon: `"${path.join(root, "Game.exe")}",0`,
  ...patch,
});

test("Battle.net scan cancels while a drive availability check is still pending", async () => {
  const controller = new AbortController();
  let started;
  const checking = new Promise((resolve) => {
    started = resolve;
  });
  const work = scanBattleNet({
    inventory: { uninstall: [record()] },
    signal: controller.signal,
    availability: () => {
      started();
      return new Promise(() => {});
    },
  });
  const rejection = assert.rejects(work, { name: "AbortError" });
  await checking;
  controller.abort();
  await rejection;
});

test("Battle.net registry discovery requires a game executable within its installation and keeps availability states", async () => {
  const inventory = {
    uninstall: [
      record(),
      record(),
      record({ PSChildName: "missing", DisplayName: "Missing" }),
      record({ PSChildName: "unavailable", DisplayName: "Unavailable" }),
      record({ DisplayName: "Battle.net" }),
      record({ DisplayIcon: path.join(root, "Battle.net.exe") }),
      record({ DisplayIcon: path.join(root + "-other", "Game.exe") }),
      record({ DisplayIcon: path.join(root, "setup.exe") }),
      record({ Publisher: "Other" }),
      record({ InstallLocation: "relative" }),
      record({ DisplayIcon: null }),
    ],
  };
  let checked = 0;
  const result = await scanBattleNet({
    inventory,
    availability: async () => ({
      status: ["installed", "uninstalled", "unknown"][checked++],
      statusReason: "Fixture check",
    }),
  });
  assert.equal(checked, 3);
  assert.deepEqual(
    result.games.map((item) => item.status),
    ["installed", "uninstalled", "unknown"],
  );
  assert.equal(new Set(result.games.map((item) => item.id)).size, 3);
  assert.equal(result.games[0].launch.target, path.join(root, "Game.exe"));
  assert.deepEqual(result.watchPaths, [root]);
});

test("Battle.net detection supports cancellation and links matching shortcuts without losing argument variants", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    scanBattleNet({
      inventory: { uninstall: [record()] },
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  const battlenet = await scanBattleNet({
    inventory: { uninstall: [record()] },
    availability: async () => ({ status: "installed" }),
  });
  const result = await scanShortcuts({
    inventory: {
      uninstall: [],
      packages: [],
      startApps: [],
      shortcuts: [
        {
          name: "Different title",
          target: path.join(root, "Game.exe"),
          path: "plain.lnk",
        },
        {
          name: "Argument variant",
          target: path.join(root, "Game.exe"),
          arguments: "--test",
          path: "variant.lnk",
        },
        {
          name: "Launcher only",
          target: path.join(root, "Battle.net.exe"),
          path: "launcher.lnk",
        },
      ],
    },
    battlenet,
    steam: { byAppId: new Map(), missingLibraries: [] },
    epic: { byAppName: new Map() },
    riot: { games: [] },
    io: { exists: async () => true },
  });
  assert.ok(battlenet.games[0].sources.includes("plain.lnk"));
  assert.equal(battlenet.games[0].launch.target, "plain.lnk");
  assert.equal(result.games.length, 2);
  assert.equal(
    result.games.find((item) => item.name === "Launcher only").status,
    "unknown",
  );
  assert.ok(result.games.find((item) => item.name === "Argument variant"));
});
