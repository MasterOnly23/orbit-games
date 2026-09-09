const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { scanRiot, installationPath } = require("../electron/library/riot.cjs");
const { registryIdentity } = require("../electron/library/model.cjs");
const {
  mergeAccountLibrary,
} = require("../electron/library/account-library.cjs");

test("Riot discovers real manifest installations without shortcuts and ignores stale PBE entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-riot-"));
  try {
    const metadata = path.join(root, "Riot Games", "Metadata"),
      install = path.join(root, "custom disk", "Game"),
      client = path.join(root, "RiotClientServices.exe");
    await fs.mkdir(install, { recursive: true });
    await fs.writeFile(
      path.join(install, "LeagueClient.exe"),
      "non-executable fixture",
    );
    await fs.writeFile(client, "non-executable fixture");
    for (const channel of ["live", "pbe"]) {
      const folder = path.join(metadata, `league_of_legends.${channel}`);
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(
        path.join(folder, `league_of_legends.${channel}.product_settings.yaml`),
        `product_install_full_path: ${JSON.stringify(channel === "live" ? install : path.join(root, "absent"))}\n`,
      );
    }
    await fs.writeFile(
      path.join(root, "Riot Games", "RiotClientInstalls.json"),
      JSON.stringify({ associated_client: { [install]: client } }),
    );
    const result = await scanRiot(root);
    assert.equal(result.games.length, 1);
    assert.equal(result.games[0].name, "League of Legends");
    assert.deepEqual(result.games[0].launchOptions.args, [
      "--launch-product=league_of_legends",
      "--launch-patchline=live",
    ]);
    assert.equal(
      result.games[0].targetExecutable,
      path.join(install, "LeagueClient.exe"),
    );
    await fs.unlink(client);
    assert.equal((await scanRiot(root)).games.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("manifest paths require absolute paths and GOG registry IDs join account entries even if names differ", () => {
  assert.equal(
    installationPath('product_install_full_path: "relative/path"'),
    null,
  );
  const identity = registryIdentity("GOG", "123456_is1");
  assert.equal(identity.providerId, "123456");
  assert.equal(registryIdentity("EA app", "123456_is1").providerId, undefined);
  const result = mergeAccountLibrary(
    [
      {
        ...identity,
        name: "Localized title",
        provider: "GOG",
        status: "installed",
        favorite: true,
      },
    ],
    { id: "account", provider: "GOG" },
    {
      complete: true,
      games: [{ productId: "123456", name: "Original title" }],
    },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].favorite, true);
  assert.equal(result[0].status, "installed");
});
