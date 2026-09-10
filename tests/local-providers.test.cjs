const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { scanSteam } = require("../electron/library/steam-local.cjs");
const { scanEpic } = require("../electron/library/epic-local.cjs");
const { idFor } = require("../electron/library/model.cjs");
const io = {
  read: (file) => fs.readFile(file, "utf8").catch(() => ""),
  exists: (file) =>
    fs.access(file).then(
      () => true,
      () => false,
    ),
  entries: (dir) => fs.readdir(dir, { withFileTypes: true }).catch(() => []),
};
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-detector-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("Steam detector preserves multiple-library identities, installation states and shortcut index", async (t) => {
  const root = await fixture(t),
    steam = path.join(root, "Steam"),
    extra = path.join(root, "Extra"),
    missing = path.join(root, "Missing");
  const quote = (value) => value.replaceAll("\\", "\\\\");
  await fs.mkdir(path.join(steam, "steamapps"), { recursive: true });
  await fs.mkdir(path.join(extra, "steamapps", "common", "Ready"), {
    recursive: true,
  });
  await fs.mkdir(path.join(extra, "steamapps", "common", "Updating"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(steam, "steamapps", "libraryfolders.vdf"),
    `"libraryfolders" { "0" { "path" "${quote(steam)}" } "1" { "path" "${quote(extra)}" } "2" { "path" "${quote(missing)}" } }`,
  );
  for (const [id, name, flags] of [
    ["10", "Ready", "4"],
    ["20", "Updating", "2"],
    ["30", "Gone", "4"],
    ["40", "Steamworks Common Redistributables", "4"],
  ]) {
    await fs.writeFile(
      path.join(extra, "steamapps", `appmanifest_${id}.acf`),
      `"AppState" { "appid" "${id}" "name" "${name}" "installdir" "${name}" "StateFlags" "${flags}" }`,
    );
  }
  const result = await scanSteam({ steamPath: steam, io });
  assert.equal(result.games.length, 3);
  assert.deepEqual(
    result.games.map((g) => g.status),
    ["installed", "unknown", "uninstalled"],
  );
  const game = result.byAppId.get("10");
  assert.equal(game, result.games[0]);
  assert.equal(game.id, idFor("steam:10"));
  assert.equal(game.launch.target, "steam://rungameid/10");
  assert.ok(result.watchPaths.includes(path.join(extra, "steamapps")));
  assert.equal(result.warnings.length, 1);
});

test("Epic detector preserves provider identity, partial installs and malformed-manifest warnings", async (t) => {
  const root = await fixture(t),
    manifests = path.join(
      root,
      "Epic",
      "EpicGamesLauncher",
      "Data",
      "Manifests",
    ),
    installed = path.join(root, "Game");
  await fs.mkdir(manifests, { recursive: true });
  await fs.mkdir(installed);
  await fs.writeFile(path.join(installed, "game.exe"), "Never executed");
  const manifest = {
    bIsApplication: true,
    DisplayName: "Game",
    LaunchExecutable: "game.exe",
    InstallLocation: installed,
    CatalogNamespace: "space",
    CatalogItemId: "item",
    AppName: "APP",
  };
  await fs.writeFile(path.join(manifests, "a.item"), JSON.stringify(manifest));
  await fs.writeFile(
    path.join(manifests, "b.item"),
    JSON.stringify({
      ...manifest,
      AppName: "PARTIAL",
      bIsIncompleteInstall: true,
    }),
  );
  await fs.writeFile(path.join(manifests, "bad.item"), "{");
  const result = await scanEpic({ programData: root, io });
  assert.equal(result.games.length, 2);
  const game = result.byAppName.get("app");
  assert.equal(game, result.games[0]);
  assert.equal(game.id, idFor("epic:APP"));
  assert.equal(game.providerId, "space:item:APP");
  assert.equal(game.status, "installed");
  assert.equal(result.byAppName.get("partial").status, "uninstalled");
  assert.equal(
    game.launch.target,
    "com.epicgames.launcher://apps/space%3Aitem%3AAPP?action=launch&silent=true",
  );
  assert.equal(result.manifestDirectory, manifests);
  assert.equal(result.warnings.length, 1);
});
