const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  parseVdf,
  mergeGames,
  validLaunchUri,
  effectiveStatus,
  executableFromIcon,
} = require("../electron/library/model.cjs");
const { LibraryStore } = require("../electron/library/store.cjs");
const { launchGame } = require("../electron/platform/launch.cjs");
test("Steam VDF preserves drive paths and nested manifest data", () => {
  const vdf =
    '"libraryfolders" { "0" { "path" "E:\\\\SteamLibrary" "apps" { "413150" "100" } } }';
  const parsed = parseVdf(vdf);
  assert.equal(parsed.libraryfolders["0"].path, "E:\\SteamLibrary");
  assert.equal(parsed.libraryfolders["0"].apps["413150"], "100");
});
test("rescans deduplicate sources, retain personal edits and do not merge stores or editions", () => {
  const game = {
    id: "one",
    name: "Test Game™",
    provider: "Steam",
    status: "installed",
    sources: ["manifest"],
    launch: { kind: "uri", target: "steam://rungameid/42" },
  };
  const old = {
    ...game,
    favorite: true,
    notes: "Keep this",
    statusOverride: "unknown",
    metadata: { steamId: "42" },
    addedAt: "2020-01-01",
  };
  const result = mergeGames(
    [
      game,
      { ...game, id: "shortcut", name: "Test Game", sources: ["shortcut"] },
      {
        ...game,
        id: "epic",
        provider: "Epic Games",
        sources: ["epic-manifest"],
      },
      {
        ...game,
        id: "edition",
        name: "Test Game Enhanced",
        sources: ["edition-manifest"],
      },
    ],
    [old],
  );
  assert.equal(result.length, 3);
  const merged = result.find((g) => g.id === "one");
  assert.deepEqual(merged.sources, ["manifest", "shortcut"]);
  assert.equal(merged.favorite, true);
  assert.equal(merged.notes, "Keep this");
  assert.equal(effectiveStatus(merged), "unknown");
  assert.equal(merged.addedAt, "2020-01-01");
});
test("an edited launch path survives automatic detection", () => {
  const original = {
    id: "test",
    name: "Test",
    provider: "Otros",
    sources: ["a"],
    status: "installed",
    launch: { kind: "file", target: "old.exe" },
  };
  const edited = {
    ...original,
    manual: true,
    launch: { kind: "file", target: "new.exe" },
    metadataCheckedAt: "today",
  };
  const result = mergeGames([original], [edited]);
  assert.equal(result[0].launch.target, "new.exe");
  assert.equal(result[0].manual, true);
  assert.equal(result[0].metadataCheckedAt, "today");
});
test("a removed source is retained but is not falsely marked installed", () => {
  const [g] = mergeGames(
    [],
    [{ id: "a", name: "Absent", sources: ["old"], status: "installed" }],
  );
  assert.equal(g.status, "unknown");
  assert.deepEqual(g.sources, []);
});
test("a newly resolved Xbox shortcut absorbs the earlier unresolved entry without duplicate IDs", () => {
  const old = [
    {
      id: "unresolved",
      name: "CloverPit",
      provider: "Otros",
      status: "unknown",
      sources: ["CloverPit.lnk"],
    },
    {
      id: "xbox",
      name: "CloverPit",
      provider: "Xbox",
      status: "installed",
      sources: ["config"],
      favorite: true,
    },
  ];
  const current = [
    {
      id: "xbox",
      name: "CloverPit",
      provider: "Xbox",
      status: "installed",
      sources: ["CloverPit.lnk"],
      launch: { kind: "app", target: "Test_package!Game" },
    },
  ];
  const result = mergeGames(current, old);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "xbox");
  assert.equal(result[0].favorite, true);
});
test("only known game launch protocols are accepted", () => {
  for (const uri of [
    "steam://rungameid/413150",
    "uplay://launch/4740/0",
    "com.epicgames.launcher://apps/test%3Aid%3Agame?action=launch&silent=true",
  ])
    assert.equal(validLaunchUri(uri), true, uri);
  for (const uri of [
    "steam://uninstall/413150",
    "https://example.org",
    "file:///C:/bad.exe",
    "cmd://calc",
    "steam://run/42\nanything",
    "com.epicgames.launcher://apps/test?action=uninstall",
  ])
    assert.equal(validLaunchUri(uri), false, uri);
});
test("missing executables and uninstalled games never reach Windows launch calls", async () => {
  let called = false;
  const shell = {
    openExternal: async () => {
      called = true;
    },
    openPath: async () => {
      called = true;
      return "";
    },
  };
  await assert.rejects(
    () =>
      launchGame(
        {
          status: "uninstalled",
          launch: { kind: "uri", target: "steam://rungameid/42" },
        },
        shell,
      ),
    /no instalado/,
  );
  await assert.rejects(
    () =>
      launchGame(
        {
          status: "installed",
          launch: {
            kind: "file",
            target: path.join(os.tmpdir(), "orbit-does-not-exist.exe"),
          },
        },
        shell,
      ),
    /No se encuentra/,
  );
  assert.equal(called, false);
});
test("a valid Steam launch uses its protocol without shell command evaluation", async () => {
  let uri;
  await launchGame(
    {
      status: "installed",
      launch: { kind: "uri", target: "steam://rungameid/42" },
    },
    {
      openExternal: async (value) => {
        uri = value;
      },
    },
  );
  assert.equal(uri, "steam://rungameid/42");
});
test("Windows icon executable extraction handles quotes and icon index", () => {
  assert.equal(
    executableFromIcon('"F:\\Game\\Game.exe",0'),
    "F:\\Game\\Game.exe",
  );
  assert.equal(
    executableFromIcon("F:\\Game\\Game.exe,0"),
    "F:\\Game\\Game.exe",
  );
});
test("atomic saves and backup recovery preserve the last valid library", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-store-"));
  try {
    const store = new LibraryStore(dir, dir);
    await store.load();
    store.data.games = [{ id: "test", favorite: true }];
    await store.save();
    store.data.games[0].notes = "saved";
    await store.save();
    const reload = new LibraryStore(dir, dir);
    await reload.load();
    assert.equal(reload.data.games[0].notes, "saved");
    await fs.writeFile(store.file, "broken json");
    const recovered = new LibraryStore(dir, dir);
    await recovered.load();
    assert.equal(recovered.data.games[0].favorite, true);
    assert.match(recovered.data.warnings[0], /respaldo/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("a missing primary library recovers its backup with new defaults and does not overwrite the valid backup with corruption", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-backup-"));
  try {
    const file = path.join(dir, "library.json");
    const backup = {
      version: 1,
      games: [{ id: "kept", favorite: true }],
      settings: { autoScan: false },
    };
    await fs.writeFile(`${file}.bak`, JSON.stringify(backup));
    const recovered = new LibraryStore(dir, dir);
    await recovered.load();
    assert.equal(recovered.data.games[0].id, "kept");
    assert.deepEqual(recovered.data.settings.gameFolders, []);
    assert.equal(recovered.data.settings.autoScan, false);
    await fs.writeFile(file, "broken");
    await recovered.save();
    assert.deepEqual(
      JSON.parse(await fs.readFile(`${file}.bak`, "utf8")),
      backup,
    );
    const reload = new LibraryStore(dir, dir);
    await reload.load();
    assert.equal(reload.data.games[0].favorite, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
