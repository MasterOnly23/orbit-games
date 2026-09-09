const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { identity, resolveDataDirectory } = require("../electron/runtime.cjs");
const {
  validateFolders,
  findExecutableCandidates,
} = require("../electron/onboarding/discovery.cjs");
const { registerOnboarding } = require("../electron/onboarding/ipc.cjs");
const { LibraryStore } = require("../electron/library/store.cjs");

test("Next identity and all writable profile overrides stay separate from stable Orbit", () => {
  const base = path.resolve(os.tmpdir(), "orbit-isolation");
  const next = path.join(base, "Orbit Games Next");
  assert.equal(resolveDataDirectory(base), next);
  assert.equal(
    resolveDataDirectory(base, path.join(next, "qa", "run")),
    path.join(next, "qa", "run"),
  );
  for (const override of [
    path.join(base, "Orbit Games"),
    base,
    path.join(base, "Orbit Games Next-other"),
    path.join(next, "..", "Orbit Games"),
  ])
    assert.throws(() => resolveDataDirectory(base, override), /propio perfil/);
  const pkg = require("../package.json");
  assert.equal(pkg.productName, identity.name);
  assert.equal(pkg.build.appId, identity.appId);
  const outputRelative = path.relative(
    path.resolve(__dirname, "../release-next"),
    path.resolve(__dirname, "..", pkg.build.directories.output),
  );
  assert.ok(!path.isAbsolute(outputRelative));
  assert.ok(
    outputRelative !== ".." && !outputRelative.startsWith(`..${path.sep}`),
  );
  assert.equal(pkg.build.nsis.shortcutName, identity.name);
});

test("folder discovery excludes tools, respects limits and requires existing non-root folders", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-discovery-"));
  try {
    await fs.mkdir(path.join(root, "Adventure"));
    await fs.writeFile(
      path.join(root, "Adventure", "Adventure.exe"),
      "fixture",
    );
    await fs.writeFile(path.join(root, "Adventure", "unins000.exe"), "fixture");
    await fs.mkdir(path.join(root, "Redist"));
    await fs.writeFile(path.join(root, "Redist", "tool.exe"), "fixture");
    assert.deepEqual(await validateFolders([root, root]), [root]);
    await assert.rejects(
      () => validateFolders([path.parse(root).root]),
      /unidad completa/,
    );
    await assert.rejects(
      () => validateFolders([path.join(root, "absent")]),
      /no está disponible/,
    );
    const found = await findExecutableCandidates([root]);
    assert.deepEqual(
      found.candidates.map((c) => c.name),
      ["Adventure"],
    );
    assert.equal(
      (await findExecutableCandidates([root], { maxEntries: 1 })).warnings
        .length,
      1,
    );
    assert.deepEqual(
      (await findExecutableCandidates([root], { maxDepth: 0 })).candidates,
      [],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("onboarding previews do not save and only confirmed candidates persist across restart", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-onboarding-"));
  try {
    const folder = path.join(root, "games");
    await fs.mkdir(folder);
    await fs.writeFile(
      path.join(folder, "Chosen.exe"),
      "fixture, never executed",
    );
    await fs.writeFile(
      path.join(folder, "Ignored.exe"),
      "fixture, never executed",
    );
    const store = new LibraryStore(path.join(root, "profile"), root);
    await store.load();
    const handlers = {};
    let saves = 0;
    registerOnboarding({
      handle: (name, fn) => {
        handlers[name] = fn;
      },
      store,
      save: async () => {
        saves++;
        await store.save();
      },
      snapshot: () => store.data,
      setWatchers: () => {},
      enrich: async () => {},
      report: () => {},
      desktop: root,
      scanLocal: async () => ({
        games: [],
        watchPaths: [],
        warnings: [],
        scannedAt: new Date().toISOString(),
      }),
    });
    const preview = await handlers["setup:preview"]({
      folders: [],
      gameFolders: [folder],
    });
    assert.equal(saves, 0);
    assert.equal(store.data.games.length, 0);
    const chosen = preview.candidates.find((c) => c.name === "Chosen");
    await assert.rejects(
      () =>
        handlers["setup:complete"]({
          previewId: "stale",
          selectedCandidates: [],
        }),
      /Vuelve a buscar/,
    );
    await assert.rejects(
      () =>
        handlers["setup:complete"]({
          previewId: preview.id,
          selectedCandidates: ["forged"],
          onlineMetadata: false,
        }),
      /no es válida/,
    );
    await handlers["setup:complete"]({
      previewId: preview.id,
      selectedCandidates: [chosen.id],
      onlineMetadata: false,
    });
    const reload = new LibraryStore(store.directory, root);
    await reload.load();
    assert.equal(reload.data.games.length, 1);
    assert.equal(reload.data.games[0].name, "Chosen");
    assert.equal(reload.data.games[0].manual, true);
    assert.ok(reload.data.onboarding.completedAt);
    assert.deepEqual(reload.data.settings.gameFolders, [folder]);
    assert.equal(reload.data.settings.onlineMetadata, false);
    await assert.rejects(
      () =>
        handlers["setup:complete"]({
          previewId: preview.id,
          selectedCandidates: [],
        }),
      /Vuelve a buscar/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
