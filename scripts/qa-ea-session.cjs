const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const { execFileSync } = require("node:child_process");
(async () => {
  const env = {
    ...process.env,
    ORBIT_SKIP_SCAN: "1",
    ORBIT_DATA_DIR: path.join(
      process.env.APPDATA,
      "Orbit Games Next",
      "qa",
      crypto.randomUUID(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  const { LibraryStore } = require("../electron/library/store.cjs");
  const initial = new LibraryStore(env.ORBIT_DATA_DIR);
  await initial.load();
  initial.data.onboarding.completedAt = new Date().toISOString();
  initial.data.settings.autoScan = false;
  await initial.save();
  fs.mkdirSync(env.ORBIT_DATA_DIR, { recursive: true });
  const key = path.join(env.ORBIT_DATA_DIR, "fixture-key.pem");
  const cert = path.join(env.ORBIT_DATA_DIR, "fixture-cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=orbit-qa.local",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let graphRequests = 0;
  let catalogMode = "valid";
  const server = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    (request, response) => {
      const url = new URL(request.url, "https://fixture.test");
      response.setHeader("Access-Control-Allow-Origin", "https://www.ea.com");
      response.setHeader("Access-Control-Allow-Headers", "authorization");
      if (request.method === "OPTIONS") {
        response.end();
        return;
      }
      if (url.pathname === "/graphql") {
        if (request.headers.authorization !== "Bearer SYNTHETIC_ONLY") {
          response.writeHead(401);
          response.end();
          return;
        }
        graphRequests++;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            data: {
              me: {
                id:
                  catalogMode === "changed-account"
                    ? "other-fixture"
                    : "ea-fixture",
                ownedGameProducts: {
                  next: null,
                  totalCount: catalogMode === "incomplete" ? 2 : 1,
                  items: [
                    {
                      id: "record1",
                      originOfferId: "Origin.fixture",
                      product: {
                        id: "product1",
                        name: "EA Fixture Game",
                        gamePlatformDetails: { gamePlatform: "PC" },
                        baseItem: { isLauncher: false },
                        gameProductUser: {
                          ownershipMethods: ["PURCHASE"],
                          entitlementId: "PRIVATE_ENTITLEMENT",
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
        );
        return;
      }
      let script = "";
      if (url.pathname === "/login")
        script = "location.href='https://www.ea.com/'";
      if (url.pathname === "/sales/deals")
        script =
          "fetch('https://service-aggregation-layer.juno.ea.com/graphql',{headers:{Authorization:'Bearer SYNTHETIC_ONLY'}}).catch(()=>{})";
      response.setHeader("Content-Type", "text/html");
      response.end(
        `<html><body>EA fixture<script>${script}</script></body></html>`,
      );
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let app;
  try {
    app = await electron.launch({
      executablePath: require("electron"),
      // TLS bypass and DNS mapping belong only to this isolated fixture process.
      args: [
        path.resolve("."),
        "--no-proxy-server",
        "--ignore-certificate-errors",
        `--host-resolver-rules=MAP * 127.0.0.1:${port}`,
      ],
      env,
    });
    const result = await app.evaluate(async () => {
      const { readProviderSession } = process.mainModule.require(
        process.cwd() + "/electron/accounts/auth-window.cjs",
      );
      const { ea } = process.mainModule.require(
        process.cwd() + "/electron/accounts/ea.cjs",
      );
      const partition = "orbit-ea-session-fixture";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const credentials = await readProviderSession({
          partition,
          provider: ea,
          interactive: false,
          signal: controller.signal,
        });
        const library = await ea.fetchLibrary(credentials);
        return {
          identity: credentials.externalId,
          complete: library.complete,
          count: library.games.length,

          containsBearer:
            JSON.stringify(credentials).includes("SYNTHETIC_ONLY"),
        };
      } finally {
        clearTimeout(timer);
      }
    });
    assert.equal(result.identity, "ea-fixture", JSON.stringify(result));
    assert.equal(result.complete, true);
    assert.equal(result.count, 1);
    assert.ok(graphRequests >= 2);
    assert.equal(result.containsBearer, false);
    await app.evaluate(async () => {
      const requireMain = (name) =>
        process.mainModule.require(process.cwd() + "/electron/" + name);
      const { LibraryStore } = requireMain("library/store.cjs");
      const { createAccountService } = requireMain("accounts/service.cjs");
      const { readProviderSession, clearProviderSession } = requireMain(
        "accounts/auth-window.cjs",
      );
      const { ea } = requireMain("accounts/ea.cjs");
      const store = new LibraryStore(process.env.ORBIT_DATA_DIR + "/service");
      await store.load();
      const service = createAccountService({
        store,
        save: () => store.save(),
        providers: { ea },
        readSession: (options) =>
          readProviderSession({ ...options, interactive: false }),
        clearSession: clearProviderSession,
      });
      globalThis.eaFixture = { store, service };
    });
    const connected = await app.evaluate(async () =>
      globalThis.eaFixture.service.connect("ea"),
    );
    assert.equal(connected.ok, true, JSON.stringify(connected));
    assert.equal(connected.count, 1);
    await app.evaluate(async () => {
      const { store } = globalThis.eaFixture;
      store.data.games[0].notes = "Keep QA note";
      store.data.games[0].favorite = true;
      await store.save();
      globalThis.eaFixture.before = JSON.stringify(store.data.games);
    });
    for (const [mode, code] of [
      ["incomplete", "incomplete"],
      ["changed-account", "account-mismatch"],
    ]) {
      catalogMode = mode;
      const failed = await app.evaluate(async () => {
        const { store, service, before } = globalThis.eaFixture;
        const result = await service.sync(store.data.accounts[0].id);
        return {
          ...result,
          unchanged: before === JSON.stringify(store.data.games),
        };
      });
      assert.equal(failed.ok, false);
      assert.equal(failed.error.code, code);
      assert.equal(failed.unchanged, true);
    }
    catalogMode = "valid";
    const persisted = await app.evaluate(async () => {
      const { store, service } = globalThis.eaFixture;
      const sync = await service.sync(store.data.accounts[0].id);
      const disconnect = await service.disconnect(store.data.accounts[0].id);
      const { LibraryStore } = process.mainModule.require(
        process.cwd() + "/electron/library/store.cjs",
      );
      const reloaded = new LibraryStore(store.directory);
      await reloaded.load();
      return {
        sync,
        disconnect,
        accounts: reloaded.data.accounts.length,
        games: reloaded.data.games.length,
        notes: reloaded.data.games[0].notes,
        favorite: reloaded.data.games[0].favorite,
        state: reloaded.data.games[0].accountEntitlements[0].state,
        containsPrivate: /SYNTHETIC_ONLY|PRIVATE_ENTITLEMENT/.test(
          JSON.stringify(reloaded.data),
        ),
      };
    });
    assert.equal(persisted.sync.ok, true);
    assert.equal(persisted.disconnect.ok, true);
    assert.equal(persisted.accounts, 0);
    assert.equal(persisted.games, 1);
    assert.equal(persisted.notes, "Keep QA note");
    assert.equal(persisted.favorite, true);
    assert.equal(persisted.state, "disconnected");
    assert.equal(persisted.containsPrivate, false);
    const page = await app.firstWindow();
    const rendererErrors = [];
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Conectar EA app", exact: true })
      .click();
    await page.getByText("EA app · Cuenta EA", { exact: true }).waitFor();
    const visibleAccount = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(visibleAccount.accounts[0].providerId, "ea");
    assert.equal(visibleAccount.games[0].name, "EA Fixture Game");
    assert.deepEqual(rendererErrors, []);
    await page.setViewportSize({ width: 1000, height: 760 });
    await page
      .getByText("EA app · Cuenta EA", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    fs.mkdirSync(path.resolve("output/playwright"), { recursive: true });
    await page.screenshot({
      path: path.resolve("output/playwright/next-ea-account.png"),
    });
    console.log(
      JSON.stringify({
        success: true,
        controlledElectronTraffic: true,
        persistedAccountLifecycle: true,
        settingsConnectButton: true,
        ...result,
      }),
    );
  } finally {
    if (app) await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
