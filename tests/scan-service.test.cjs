const test = require("node:test");
const assert = require("node:assert/strict");
const { createScanService } = require("../electron/library/scan-service.cjs");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(overrides = {}) {
  const game = {
    id: "a".repeat(20),
    name: "Original",
    provider: "Other",
    sources: [],
    manual: true,
    launch: { kind: "file", target: "C:\\Games\\Game.exe" },
    status: "installed",
    notes: "before",
  };
  const store = {
    data: {
      games: [game],
      onboarding: { completedAt: "date" },
      settings: { folders: [], gameFolders: [] },
      discovery: { candidates: [] },
      warnings: [],
      scannedAt: "old",
    },
    save: async () => {},
  };
  let scanning = false,
    commits = 0;
  const service = createScanService({
    store,
    scanLocal: async () => ({
      games: [],
      warnings: [],
      watchPaths: [],
      scannedAt: "new",
    }),
    discover: async () => ({ candidates: [], warnings: [] }),
    availability: async () => ({ status: "uninstalled" }),
    snapshot: () => ({ ...store.data, scanning }),
    setScanning: (value) => {
      scanning = value;
    },
    setWatchers: () => {},
    onError: () => {},
    onCommitted: () => {
      commits++;
    },
    ...overrides,
  });
  return { store, service, getCommits: () => commits };
}
test("cancel during late folder discovery leaves the library untouched and permits another scan", async () => {
  const started = deferred(),
    late = deferred();
  let attempts = 0;
  const { store, service, getCommits } = fixture({
    discover: async () => {
      if (++attempts === 1) {
        started.resolve();
        return late.promise;
      }
      return { candidates: [], warnings: [] };
    },
  });
  const before = JSON.stringify(store.data);
  const run = service.run();
  await started.promise;
  assert.equal(JSON.stringify(store.data), before);
  assert.equal(service.cancel(), true);
  const result = await run;
  assert.equal(result.scanCancelled, true);
  assert.equal(result.scanning, false);
  assert.equal(JSON.stringify(store.data), before);
  late.resolve({ candidates: [], warnings: ["Late warning"] });
  await service.run();
  assert.equal(store.data.scannedAt, "new");
  assert.equal(store.data.games[0].status, "uninstalled");
  assert.equal(getCommits(), 1);
});
test("scan commits current user edits and does not apply availability to a changed launch path", async () => {
  const started = deferred(),
    read = deferred();
  const { store, service } = fixture({
    availability: async () => {
      started.resolve();
      return read.promise;
    },
  });
  const run = service.run();
  await started.promise;
  store.data.games[0] = {
    ...store.data.games[0],
    notes: "edited during scan",
    launch: { kind: "file", target: "D:\\New\\Game.exe" },
  };
  read.resolve({ status: "uninstalled" });
  await run;
  assert.equal(store.data.games[0].notes, "edited during scan");
  assert.equal(store.data.games[0].status, "installed");
  assert.equal(store.data.games[0].launch.target, "D:\\New\\Game.exe");
});
test("a committing scan cannot be cancelled and failed saves retain the previous catalog", async () => {
  const started = deferred(),
    finish = deferred();
  const { store, service } = fixture();
  const before = store.data.games;
  store.save = async () => {
    started.resolve();
    await finish.promise;
    throw new Error("disk failure");
  };
  const run = service.run();
  const rejected = assert.rejects(run, /disk failure/);
  await started.promise;
  assert.equal(service.cancel(), false);
  finish.resolve();
  await rejected;
  assert.equal(store.data.games, before);
  assert.equal(store.data.scannedAt, "old");
});
