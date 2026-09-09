const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { registerOnboarding } = require("../electron/onboarding/ipc.cjs");
const { windowsInventory } = require("../electron/library/scanner.cjs");
const {
  findExecutableCandidates,
} = require("../electron/onboarding/discovery.cjs");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test("cancelled setup discards late results, permits retry and cannot interrupt committing", async () => {
  const handlers = {},
    first = deferred(),
    started = deferred(),
    saving = deferred(),
    saveGate = deferred();
  const scan = {
    games: [],
    watchPaths: [],
    warnings: [],
    scannedAt: "2026-09-09",
  };
  const store = {
    data: { games: [], settings: {}, onboarding: { completedAt: null } },
  };
  let calls = 0,
    saves = 0;
  registerOnboarding({
    handle: (name, callback) => {
      handlers[name] = callback;
    },
    store,
    snapshot: () => store.data,
    setWatchers: () => {},
    enrich: async () => {},
    report: () => {},
    save: async () => {
      saves++;
      saving.resolve();
      await saveGate.promise;
    },
    scanLocal: async (_folders, _script, { signal }) => {
      assert.ok(signal instanceof AbortSignal);
      if (++calls === 1) {
        started.resolve();
        return first.promise;
      }
      return scan;
    },
  });
  const work = handlers["setup:preview"]({ folders: [], gameFolders: [] });
  await started.promise;
  assert.equal(handlers["setup:cancel"](), true);
  assert.deepEqual(await work, { cancelled: true });
  assert.equal(saves, 0);
  assert.equal(store.data.onboarding.completedAt, null);
  const retry = await handlers["setup:preview"]({
    folders: [],
    gameFolders: [],
  });
  first.resolve({
    ...scan,
    games: [{ id: "late", name: "Late game", provider: "Other", sources: [] }],
  });
  await Promise.resolve();
  assert.equal(handlers["setup:cancel"](), false);
  const complete = handlers["setup:complete"]({
    previewId: retry.id,
    selectedCandidates: [],
    onlineMetadata: false,
  });
  await saving.promise;
  assert.equal(handlers["setup:cancel"](), false);
  saveGate.resolve();
  await complete;
  assert.equal(saves, 1);
  assert.deepEqual(store.data.games, []);
});
test("folder search refuses already-cancelled work", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    findExecutableCandidates([], { signal: controller.signal }),
    { name: "AbortError" },
  );
});
test(
  "cancelling Windows inventory terminates its own PowerShell process",
  { skip: process.platform !== "win32", timeout: 15000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-cancel-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const marker = path.join(root, "pid.txt"),
      script = path.join(root, "inventory.ps1");
    await fs.writeFile(
      script,
      `[System.IO.File]::WriteAllText('${marker.replaceAll("'", "''")}', [string]$PID)\nStart-Sleep -Seconds 60\nWrite-Output '{}'`,
    );
    const controller = new AbortController();
    const work = windowsInventory([], script, { signal: controller.signal });
    const rejection = assert.rejects(work, { name: "AbortError" });
    let pid;
    try {
      const deadline = Date.now() + 5000;
      while (!pid && Date.now() < deadline) {
        pid = Number(await fs.readFile(marker, "utf8").catch(() => ""));
        if (!pid) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(pid > 0);
      controller.abort();
      await rejection;
      let running = true;
      const deadline2 = Date.now() + 3000;
      while (running && Date.now() < deadline2) {
        try {
          process.kill(pid, 0);
        } catch {
          running = false;
        }
        if (running) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(running, false);
    } finally {
      controller.abort();
      await rejection;
    }
  },
);
