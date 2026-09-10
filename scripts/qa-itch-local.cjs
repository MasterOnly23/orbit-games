const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { LibraryStore } = require("../electron/library/store.cjs");
(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const root = path.join(profile, "itch-location"),
    gameDir = path.join(root, "qa-game");
  let app;
  try {
    await fs.mkdir(path.join(gameDir, ".itch"), { recursive: true });
    await fs.writeFile(
      path.join(gameDir, "game.exe"),
      "QA fixture never executed",
    );
    await fs.writeFile(
      path.join(gameDir, ".itch", "receipt.json.gz"),
      gzipSync(
        JSON.stringify({
          game: {
            id: 987654321,
            title: "Orbit QA Itch Local",
            classification: "game",
          },
          files: ["game.exe"],
        }),
      ),
    );
    const store = new LibraryStore(profile);
    await store.load();
    store.data.onboarding.completedAt = new Date().toISOString();
    store.data.settings.gameFolders = [root];
    store.data.settings.autoScan = false;
    await store.save();
    const env = {
      ...process.env,
      ORBIT_DATA_DIR: profile,
      ORBIT_SKIP_SCAN: "1",
    };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ORBIT_DEV_URL;
    app = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const page = await app.firstWindow();
    await page
      .getByRole("button", { name: "Detectar juegos nuevos", exact: true })
      .waitFor();
    const library = await page.evaluate(() => window.orbit.scan());
    const game = library.games.find((g) => g.providerId === "987654321");
    assert.equal(game.provider, "itch.io");
    assert.equal(game.status, "installed");
    await app.evaluate(({ shell }) => {
      globalThis.qaItchLaunch = null;
      shell.openExternal = async (uri) => {
        globalThis.qaItchLaunch = uri;
      };
    });
    await page.evaluate((id) => window.orbit.launch(id), game.id);
    assert.equal(
      await app.evaluate(() => globalThis.qaItchLaunch),
      "itch://install?game_id=987654321&launch",
    );
    const preview = await page.evaluate(
      (gameFolders) => window.orbit.setupPreview({ folders: [], gameFolders }),
      [root],
    );
    assert.ok(
      preview.platforms.some((p) => p.name === "itch.io" && p.count >= 1),
    );
    console.log(
      JSON.stringify({
        success: true,
        customLocationDetected: true,
        onboardingPreviewDetected: true,
        launchHandedToItch: true,
        realGameNotExecuted: true,
      }),
    );
  } finally {
    if (app) await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
