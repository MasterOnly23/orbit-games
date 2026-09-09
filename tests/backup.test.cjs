const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { LibraryStore } = require("../electron/library/store.cjs");
const {
  createBackup,
  writeBackup,
  readBackup,
  restoreBackup,
  artworkName,
} = require("../electron/library/backup.cjs");
const { mergeGames } = require("../electron/library/model.cjs");

const id = "a".repeat(20),
  otherId = "b".repeat(20);
const game = () => ({
  id,
  name: "Manual game",
  provider: "Manual",
  manual: true,
  launch: { kind: "file", target: "D:\\Games\\Game.exe" },
  launchOptions: {
    args: ["--profile", "My profile"],
    workingDirectory: "D:\\Games",
  },
  favorite: true,
  notes: "My progress",
  sources: [],
  status: "installed",
  statusOverride: "installed",
  artworkRevision: 1,
  accountEntitlements: [{ accountId: "PRIVATE_ACCOUNT" }],
  ticket: "PRIVATE_TICKET",
});
async function workspace(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-backup-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
test("portable backup restores manual games and exact artwork after restart without account material", async (t) => {
  const directory = await workspace(t),
    source = new LibraryStore(path.join(directory, "source"));
  await source.load();
  source.data.games = [game()];
  source.data.accounts = [{ token: "PRIVATE_TOKEN" }];
  await fs.mkdir(path.join(source.directory, "artwork"));
  const bytes = Buffer.from("controlled image bytes");
  await fs.writeFile(
    path.join(source.directory, "artwork", `${id}.jpg`),
    bytes,
  );
  const backup = await createBackup(source),
    file = path.join(directory, "copy.json");
  assert.ok(!JSON.stringify(backup).includes("PRIVATE_"));
  await writeBackup(file, backup);
  const parsed = await readBackup(file, (image) => image.equals(bytes));
  const destination = new LibraryStore(path.join(directory, "destination"));
  await destination.load();
  destination.data.accounts = [{ id: "keep-account" }];
  destination.data.settings.folders = ["E:\\Shortcuts"];
  await restoreBackup(destination, parsed, () => destination.save());
  const reopened = new LibraryStore(destination.directory);
  await reopened.load();
  const restored = reopened.getGame(id);
  assert.deepEqual(restored.launchOptions, game().launchOptions);
  assert.equal(restored.status, "unknown");
  assert.equal(restored.statusOverride, "auto");
  assert.equal(restored.favorite, true);
  assert.deepEqual(restored.accountEntitlements, []);
  assert.deepEqual(reopened.data.accounts, [{ id: "keep-account" }]);
  assert.deepEqual(reopened.data.settings.folders, ["E:\\Shortcuts"]);
  assert.deepEqual(
    await fs.readFile(
      path.join(reopened.directory, "artwork", artworkName(restored)),
    ),
    bytes,
  );
  assert.equal(
    mergeGames([{ ...game(), artworkRevision: null }], [restored])[0]
      .artworkFile,
    restored.artworkFile,
  );
  assert.equal(
    (await createBackup(reopened)).artwork[0].data,
    bytes.toString("base64"),
  );
});
test("restore retains current launch routes, unrelated games and artwork if persistence fails", async (t) => {
  const directory = await workspace(t),
    store = new LibraryStore(directory);
  await store.load();
  const current = {
    ...game(),
    launch: { kind: "file", target: "E:\\Games\\Current.exe" },
    notes: "current",
  };
  store.data.games = [current, { ...game(), id: otherId }];
  const bytes = Buffer.from("new image"),
    backup = {
      legacy: false,
      games: [game()],
      artwork: [
        {
          id,
          bytes,
          file: `${createHash("sha256").update(bytes).digest("hex")}.jpg`,
        },
      ],
    };
  await assert.rejects(
    restoreBackup(store, backup, async () => {
      throw new Error("disk failure");
    }),
    /disk failure/,
  );
  assert.equal(store.getGame(id), current);
  await restoreBackup(store, backup, () => store.save());
  assert.equal(store.getGame(id).launch.target, current.launch.target);
  assert.equal(store.data.games.length, 2);
  assert.equal(store.getGame(id).notes, game().notes);
});
test("invalid paths, duplicated IDs, altered artwork and unsupported versions are rejected before restore", async (t) => {
  const directory = await workspace(t),
    file = path.join(directory, "copy.json");
  const valid = {
    format: "orbit-next-library",
    version: 2,
    games: [game()],
    artwork: [],
  };
  const cases = [
    { ...valid, version: 3 },
    { ...valid, games: [game(), game()] },
    { ...valid, games: [{ ...game(), id: "../../escape" }] },
    {
      ...valid,
      games: [{ ...game(), launch: { kind: "file", target: "C:\\bad.cmd" } }],
    },
    {
      ...valid,
      games: [
        { ...game(), launch: { kind: "uri", target: "https://example.com" } },
      ],
    },
    { ...valid, artwork: [{ id, data: "YQ==", sha256: "wrong" }] },
  ];
  for (const value of cases) {
    await fs.writeFile(file, JSON.stringify(value));
    await assert.rejects(readBackup(file, () => true));
  }
  await fs.writeFile(
    file,
    JSON.stringify({
      version: 1,
      preferences: [{ id, favorite: false, notes: "legacy" }],
    }),
  );
  const legacy = await readBackup(file, () => true);
  const store = new LibraryStore(path.join(directory, "legacy"));
  await store.load();
  assert.equal(await restoreBackup(store, legacy, () => store.save()), 0);
  store.data.games = [game()];
  assert.equal(await restoreBackup(store, legacy, () => store.save()), 1);
  assert.equal(store.getGame(id).notes, "legacy");
});
