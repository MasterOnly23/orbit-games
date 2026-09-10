const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const { scanItch } = require("../electron/library/itch-local.cjs");
const { validLaunchUri } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
} = require("../electron/library/account-library.cjs");

test("itch receipts discover games without reading account data, exclude tools and distinguish stale files", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-itch-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  async function receipt(
    folder,
    id,
    classification = "game",
    files = ["game.exe"],
  ) {
    const dir = path.join(root, folder);
    await fs.mkdir(path.join(dir, ".itch"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".itch", "receipt.json.gz"),
      gzipSync(
        JSON.stringify({ game: { id, title: folder, classification }, files }),
      ),
    );
    return dir;
  }
  const installed = await receipt("Installed", 10);
  await fs.writeFile(
    path.join(installed, "game.exe"),
    "Test fixture, never executed",
  );
  await receipt("Missing", 20);
  await receipt("Tool", 30, "tool");
  await receipt("Outside", 40, "game", [
    "../Installed/game.exe",
    "C:\\Windows\\notepad.exe",
  ]);
  await receipt("downloads/Staged", 50);
  const result = await scanItch({ roots: [root, root] });
  assert.equal(result.games.length, 3);
  assert.equal(
    result.games.find((g) => g.providerId === "10").status,
    "installed",
  );
  assert.equal(
    result.games.find((g) => g.providerId === "20").status,
    "unknown",
  );
  assert.equal(
    result.games.find((g) => g.providerId === "40").status,
    "unknown",
  );
  assert.ok(result.games.every((g) => validLaunchUri(g.launch.target)));
  const synced = mergeAccountLibrary(
    result.games,
    { id: "account", provider: "itch.io" },
    {
      complete: true,
      games: [{ productId: "10", name: "Installed", access: "owned" }],
    },
  );
  assert.equal(synced.length, 3);
  assert.equal(
    synced.find((g) => g.providerId === "10").accountEntitlements.length,
    1,
  );
  await fs.writeFile(
    path.join(installed, ".itch", "receipt.json.gz"),
    gzipSync(Buffer.alloc(5 * 1024 * 1024)),
  );
  assert.ok((await scanItch({ roots: [root] })).warnings.length);
});

test("itch detection respects cancellation and only accepts the narrow launch URI", async () => {
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assert.rejects(
    scanItch({ roots: [path.resolve(".")], signal: controller.signal }),
    /cancelled/,
  );
  for (const uri of [
    "itch://install?game_id=1&launch&other=x",
    "itch://install?game_id=-1&launch",
    "itch://evil",
    "itch://install?game_id=1&launch\n",
  ])
    assert.equal(validLaunchUri(uri), false);
});
