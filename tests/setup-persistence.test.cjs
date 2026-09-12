const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { LibraryStore } = require("../electron/library/store.cjs");
const { registerOnboarding } = require("../electron/onboarding/ipc.cjs");

test("failed setup write preserves stored and in-memory state and permits the same preview to retry", async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "orbit-setup-save-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new LibraryStore(directory);
  await store.load();
  await store.save();
  const before = structuredClone(store.data);
  const diskBefore = await fs.readFile(store.file, "utf8");
  const handlers = {};
  let watches = 0,
    enrichments = 0;
  registerOnboarding({
    handle: (name, callback) => {
      handlers[name] = callback;
    },
    store,
    save: () => store.save(),
    snapshot: () => store.data,
    setWatchers: () => {
      watches++;
    },
    enrich: async () => {
      enrichments++;
    },
    report: () => {},
    scanLocal: async () => ({
      games: [
        {
          id: "a".repeat(20),
          name: "Detected fixture",
          provider: "Steam",
          sources: [],
        },
      ],
      warnings: [],
      watchPaths: [],
      scannedAt: "2026-09-12",
    }),
  });
  const preview = await handlers["setup:preview"]({
    folders: [],
    gameFolders: [],
  });
  const input = {
    previewId: preview.id,
    selectedCandidates: [],
    onlineMetadata: true,
    metadataLanguage: "english",
    metadataCountry: "US",
  };
  const rename = fs.rename;
  t.after(() => {
    fs.rename = rename;
  });
  fs.rename = async (from, to) => {
    if (to === store.file)
      throw Object.assign(new Error("fixture no space"), { code: "ENOSPC" });
    return rename(from, to);
  };
  await assert.rejects(handlers["setup:complete"](input), /No se pudo guardar/);
  fs.rename = rename;
  assert.deepEqual(store.data, before);
  assert.equal(await fs.readFile(store.file, "utf8"), diskBefore);
  assert.equal(watches, 0);
  assert.equal(enrichments, 0);
  await handlers["setup:complete"](input);
  const restarted = new LibraryStore(directory);
  await restarted.load();
  assert.ok(restarted.data.onboarding.completedAt);
  assert.equal(restarted.data.settings.metadataLanguage, "english");
  assert.equal(restarted.data.games[0].name, "Detected fixture");
  assert.equal(watches, 1);
  assert.equal(enrichments, 1);
});
