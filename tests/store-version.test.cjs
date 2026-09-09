const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { LibraryStore } = require("../electron/library/store.cjs");
async function directory(t) {
  const result = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-version-"));
  t.after(() => fs.rm(result, { recursive: true, force: true }));
  return result;
}
test("a newer primary library is never replaced by an older compatible backup", async (t) => {
  const root = await directory(t),
    store = new LibraryStore(root);
  const primary = JSON.stringify({
    version: 2,
    games: [{ id: "future", notes: "new data" }],
  });
  const backup = JSON.stringify({ version: 1, games: [] });
  await fs.writeFile(store.file, primary);
  await fs.writeFile(`${store.file}.bak`, backup);
  await assert.rejects(store.load(), { code: "UNSUPPORTED_LIBRARY_VERSION" });
  await assert.rejects(store.save(), /no se abrió/);
  assert.equal(await fs.readFile(store.file, "utf8"), primary);
  assert.equal(await fs.readFile(`${store.file}.bak`, "utf8"), backup);
  await assert.rejects(fs.access(`${store.file}.tmp`));
});
test("incompatible backup and failed initial load also prevent subsequent writes", async (t) => {
  const root = await directory(t),
    store = new LibraryStore(root);
  await fs.writeFile(store.file, "broken");
  const backup = JSON.stringify({ version: 3, games: [] });
  await fs.writeFile(`${store.file}.bak`, backup);
  await assert.rejects(store.load(), { code: "UNSUPPORTED_LIBRARY_VERSION" });
  await assert.rejects(store.save());
  assert.equal(await fs.readFile(store.file, "utf8"), "broken");
  assert.equal(await fs.readFile(`${store.file}.bak`, "utf8"), backup);
  const unopened = new LibraryStore(path.join(root, "unopened"));
  await assert.rejects(unopened.save(), /no se abrió/);
});
test("an unreadable primary is not silently recovered over and malformed structure can recover", async (t) => {
  const root = await directory(t),
    store = new LibraryStore(root);
  await fs.mkdir(store.file);
  await fs.writeFile(
    `${store.file}.bak`,
    JSON.stringify({ version: 1, games: [] }),
  );
  await assert.rejects(store.load());
  await assert.rejects(store.save());
  assert.equal((await fs.stat(store.file)).isDirectory(), true);
  await fs.rmdir(store.file);
  await fs.writeFile(
    store.file,
    JSON.stringify({ version: 1, games: [], settings: "bad" }),
  );
  await store.load();
  assert.equal(store.recoveredFromBackup, true);
  await store.save();
  assert.deepEqual(
    JSON.parse(await fs.readFile(store.file, "utf8")).settings.gameFolders,
    [],
  );
});
