const test = require("node:test");
const assert = require("node:assert/strict");
const { registerOnboarding } = require("../electron/onboarding/ipc.cjs");

test("setup validates locale before mutations and commits it only on completion", async () => {
  const handlers = {},
    store = {
      data: {
        games: [],
        settings: {
          onlineMetadata: false,
          metadataLanguage: "spanish",
          metadataCountry: "AR",
        },
        onboarding: { completedAt: null },
      },
    };
  let saves = 0;
  registerOnboarding({
    handle: (name, callback) => {
      handlers[name] = callback;
    },
    store,
    save: async () => {
      saves++;
    },
    snapshot: () => store.data,
    setWatchers: () => {},
    enrich: async () => {},
    report: () => {},
    scanLocal: async () => ({
      games: [],
      warnings: [],
      watchPaths: [],
      scannedAt: "2026-09-12",
    }),
  });
  const before = structuredClone(store.data);
  const preview = await handlers["setup:preview"]({
    folders: [],
    gameFolders: [],
  });
  assert.deepEqual(store.data, before);
  const input = {
    previewId: preview.id,
    selectedCandidates: [],
    onlineMetadata: true,
    metadataLanguage: "english",
    metadataCountry: "INVALID",
  };
  await assert.rejects(handlers["setup:complete"](input));
  assert.deepEqual(store.data, before);
  assert.equal(saves, 0);
  await handlers["setup:complete"]({
    ...input,
    onlineMetadata: false,
    metadataCountry: "US",
  });
  assert.equal(saves, 1);
  assert.equal(store.data.settings.metadataLanguage, "english");
  assert.equal(store.data.settings.metadataCountry, "US");
  assert.equal(store.data.settings.onlineMetadata, false);
  assert.ok(store.data.onboarding.completedAt);
});
