const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { LibraryStore } = require("../electron/library/store.cjs");
(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const store = new LibraryStore(profile);
  await store.load();
  store.data.onboarding.completedAt = new Date().toISOString();
  store.data.settings.autoScan = false;
  await store.save();
  const env = { ...process.env, ORBIT_DATA_DIR: profile, ORBIT_SKIP_SCAN: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  let app;
  try {
    app = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const page = await app.firstWindow(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await app.evaluate(({ app }) => {
      globalThis.qaBattleNetMode = "valid";
      globalThis.qaBattleNetWindow = null;
      app.on("browser-window-created", (_event, win) => {
        const prefs = win.webContents.getLastWebPreferences();
        globalThis.qaBattleNetWindow = {
          node: prefs.nodeIntegration,
          isolated: prefs.contextIsolation,
          preload: !!prefs.preload,
        };
      });
      app.on("session-created", (isolated) =>
        isolated.protocol.handle("https", (request) => {
          const url = new URL(request.url);
          if (url.hostname !== "account.battle.net")
            return new Response("Blocked", { status: 400 });
          if (url.pathname.startsWith("/oauth2/"))
            return new Response("<html>Controlled provider login</html>", {
              headers: { "Content-Type": "text/html" },
            });
          if (url.pathname === "/api/")
            return Response.json({
              authenticated: true,
              privateField: "PRIVATE_TOKEN",
            });
          if (url.pathname === "/api/games-and-subs")
            return Response.json({
              gameAccounts: [
                {
                  titleId: 123,
                  localizedGameName: "Battle.net QA Game",
                  gameAccountName: "PRIVATE_NAME",
                },
              ],
            });
          if (url.pathname === "/api/classic-games")
            return Response.json({
              classicGames:
                globalThis.qaBattleNetMode === "classic"
                  ? [{ cdKeys: ["PRIVATE_KEY"] }]
                  : [],
            });
          return new Response("Blocked", { status: 400 });
        }),
      );
    });
    await page
      .getByRole("button", { name: "Conectar Battle.net", exact: true })
      .click();
    await page
      .getByText("Cuenta conectada y biblioteca importada.", { exact: true })
      .waitFor();
    const library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.accounts.length, 1);
    assert.equal(library.accounts[0].identityVerified, false);
    assert.equal(library.games[0].accountEntitlements[0].kind, "unknown");
    assert.ok(!JSON.stringify(library).includes("PRIVATE"));
    assert.deepEqual(await app.evaluate(() => globalThis.qaBattleNetWindow), {
      node: false,
      isolated: true,
      preload: false,
    });
    const id = library.accounts[0].id;
    await app.evaluate(() => {
      globalThis.qaBattleNetMode = "classic";
    });
    const failed = await page.evaluate(
      (id) => window.orbit.syncAccount(id),
      id,
    );
    assert.equal(failed.error.code, "unsupported-catalog");
    assert.deepEqual(
      (await page.evaluate(() => window.orbit.getLibrary())).games,
      library.games,
    );
    await app.evaluate(() => {
      globalThis.qaBattleNetMode = "valid";
    });
    assert.equal(
      (await page.evaluate((id) => window.orbit.syncAccount(id), id)).ok,
      true,
    );
    assert.ok(
      !(await fs.readFile(path.join(profile, "library.json"), "utf8")).includes(
        "PRIVATE",
      ),
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.disconnectAccount(id), id)).ok,
      true,
    );
    const disconnected = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(disconnected.accounts.length, 0);
    assert.equal(disconnected.games.length, 1);
    assert.equal(
      disconnected.games[0].accountEntitlements[0].state,
      "disconnected",
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        success: true,
        controlledProviderResponses: true,
        isolatedAuthWindow: true,
        sessionIdentityDisclosed: true,
        incompleteCatalogPreserved: true,
        syncAndDisconnect: true,
        privateFieldsExcluded: true,
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
