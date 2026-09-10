const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { scanShortcuts } = require("../electron/library/windows-shortcuts.cjs");
const { scanRegistry } = require("../electron/library/windows-registry.cjs");
const { scanXbox } = require("../electron/library/xbox-local.cjs");
const { scanSteam } = require("../electron/library/steam-local.cjs");
const base = () => ({
  shortcuts: [],
  packages: [],
  startApps: [],
  ubisoft: [],
  uninstall: [],
  drives: [],
  packageScanOk: true,
});
const io = {
  exists: async () => false,
  read: async () => "",
  entries: async () => [],
};

test("malformed Epic escapes do not abort other shortcuts and uppercase valid URIs still match manifests", async () => {
  const existing = { sources: [] };
  const result = await scanShortcuts({
    inventory: {
      ...base(),
      shortcuts: [
        {
          name: "Bad",
          path: "bad.url",
          url: "com.epicgames.launcher://apps/%?action=launch",
        },
        {
          name: "Escape",
          path: "escape.url",
          url: "com.epicgames.launcher://apps/a%2Fb?action=launch",
        },
        {
          name: "Good",
          path: "good.url",
          url: "COM.EPICGAMES.LAUNCHER://APPS/space%3Aitem%3AAPP?action=launch",
        },
        { name: "Steam", path: "steam.url", url: "steam://rungameid/10" },
      ],
    },
    steam: { byAppId: new Map(), missingLibraries: [] },
    epic: { byAppName: new Map([["app", existing]]), manifestDirectory: "" },
    riot: { games: [] },
    io,
  });
  assert.deepEqual(existing.sources, ["good.url"]);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].provider, "Steam");
  assert.equal(result.warnings.length, 1);
});

test("registry path attribution respects directory boundaries and case", async () => {
  const root = path.resolve("Games", "PublisherGame");
  const result = await scanShortcuts({
    inventory: {
      ...base(),
      uninstall: [
        {
          InstallLocation: root.toUpperCase(),
          DisplayName: "Registered Game",
          Publisher: "Electronic Arts",
        },
      ],
      shortcuts: [
        {
          name: "Inside",
          path: "inside.lnk",
          target: path.join(root, "bin", "game.exe"),
        },
        {
          name: "Sibling",
          path: "sibling.lnk",
          target: path.join(root + "-Other", "game.exe"),
        },
      ],
    },
    steam: { byAppId: new Map(), missingLibraries: [] },
    epic: { byAppName: new Map() },
    riot: { games: [] },
    io: { ...io, exists: async () => true },
  });
  assert.equal(
    result.games.find((g) => g.name === "Inside").provider,
    "EA app",
  );
  assert.equal(
    result.games.find((g) => g.name === "Sibling").provider,
    "Otros",
  );
});

test("Steam shortcut without manifest stays unknown if a library is inaccessible, otherwise uninstalled", async () => {
  const inventory = {
    ...base(),
    shortcuts: [
      { name: "Game", url: "steam://rungameid/10", path: "Game.url" },
    ],
  };
  const steam = await scanSteam({
    steamPath: path.resolve("MissingSteam"),
    io,
  });
  const options = {
    inventory,
    steam,
    epic: { byAppName: new Map(), manifestDirectory: "" },
    riot: { games: [] },
    io,
  };
  assert.equal((await scanShortcuts(options)).games[0].status, "unknown");
  assert.equal(
    (
      await scanShortcuts({
        ...options,
        steam: { ...steam, missingLibraries: [] },
      })
    ).games[0].status,
    "uninstalled",
  );
  const existing = { sources: [] };
  steam.byAppId.set("10", existing);
  assert.equal((await scanShortcuts(options)).games.length, 0);
  assert.deepEqual(existing.sources, ["Game.url"]);
});

test("a shared Riot launcher alone does not prove that its game is installed", async () => {
  const inventory = {
    ...base(),
    shortcuts: [
      {
        name: "VALORANT",
        target: "C:\\Riot\\RiotClientServices.exe",
        path: "Valorant.lnk",
        arguments: "--launch-product=valorant --launch-patchline=live",
      },
    ],
  };
  const options = {
    inventory,
    steam: { byAppId: new Map(), missingLibraries: [] },
    epic: { byAppName: new Map() },
    riot: { games: [] },
    io: { ...io, exists: async () => true },
  };
  assert.equal((await scanShortcuts(options)).games[0].status, "unknown");
  options.riot.games.push({
    providerId: "valorant:live",
    status: "installed",
    statusReason: "Verified manifest",
    targetExecutable: "C:\\Riot\\Valorant.exe",
  });
  assert.equal((await scanShortcuts(options)).games[0].status, "installed");
});

test("registry detection excludes launchers and uninstallers and preserves GOG product identity", async () => {
  const row = {
    Publisher: "GOG.com",
    InstallLocation: "C:\\Games",
    DisplayName: "Game",
    DisplayIcon: '"C:\\Games\\game.exe",0',
    PSChildName: "123_is1",
  };
  const inventory = {
    ...base(),
    uninstall: [
      row,
      { ...row, DisplayName: "Launcher" },
      {
        ...row,
        DisplayName: "Another",
        DisplayIcon: "C:\\Games\\unins000.exe",
      },
    ],
  };
  const options = {
    inventory,
    knownGames: [],
    io: { ...io, exists: async () => true },
  };
  const result = await scanRegistry(options);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].providerId, "123");
  assert.equal(
    (await scanRegistry({ ...options, knownGames: result.games })).games.length,
    0,
  );
});

test("automatic Windows package discovery requires a game manifest and avoids duplicate shortcuts", async () => {
  const inventory = {
    ...base(),
    packages: [
      {
        Name: "Game",
        PackageFamilyName: "game_family",
        InstallLocation: path.resolve("Game"),
      },
      {
        Name: "Calculator",
        PackageFamilyName: "calculator_family",
        InstallLocation: path.resolve("Calculator"),
      },
    ],
    startApps: [
      { Name: "Game", AppID: "game_family!App" },
      { Name: "Calculator", AppID: "calculator_family!App" },
    ],
  };
  const options = {
    inventory,
    knownGames: [],
    io: {
      ...io,
      exists: async (file) =>
        file === path.resolve("Game", "MicrosoftGame.config"),
    },
  };
  const result = await scanXbox(options);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0].launch.target, "game_family!App");
  assert.equal(
    (await scanXbox({ ...options, knownGames: result.games })).games.length,
    0,
  );
});
