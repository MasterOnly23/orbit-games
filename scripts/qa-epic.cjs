const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");

(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const env = { ...process.env, ORBIT_DATA_DIR: profile, ORBIT_SKIP_SCAN: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  let application;
  try {
    application = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const page = await application.firstWindow();
    await page.waitForFunction(() => !!window.orbit);
    await application.evaluate(({ app }) => {
      globalThis.orbitEpicQa = { grants: [], isolated: false };
      app.on("session-created", (isolated) => {
        isolated.protocol.handle(
          "https",
          () =>
            new Response(
              `<html><body><script>document.body.dataset.orbitBridge = String(!!window.orbit)</script>localhost/launcher/authorized?code=${"c".repeat(32)}</body></html>`,
              { headers: { "Content-Type": "text/html" } },
            ),
        );
      });
      app.on("web-contents-created", (_event, contents) => {
        contents.on("did-finish-load", async () => {
          if (contents.getURL().startsWith("https://www.epicgames.com/")) {
            globalThis.orbitEpicQa.isolated = await contents
              .executeJavaScript("typeof window.orbit === 'undefined'")
              .catch(() => false);
          }
        });
      });
      globalThis.fetch = async (address, options) => {
        const url = new URL(address);
        if (
          url.hostname === "account-public-service-prod03.ol.epicgames.com" &&
          url.pathname.endsWith("/oauth/token")
        ) {
          globalThis.orbitEpicQa.grants.push(
            new URLSearchParams(options.body).get("grant_type"),
          );
          return new Response(
            JSON.stringify({
              account_id: "a".repeat(32),
              displayName: "Orbit Epic QA",
              access_token: "ORBIT_SYNTHETIC_EPIC_ACCESS",
              refresh_token: "ORBIT_SYNTHETIC_EPIC_REFRESH",
              expires_at: "2030-01-01T00:00:00Z",
            }),
          );
        }
        if (url.hostname === "library-service.live.use1a.on.epicgames.com")
          return new Response(
            JSON.stringify({
              records: [
                { namespace: "qa", catalogItemId: "item", appName: "OrbitQa" },
              ],
              responseMetadata: {},
            }),
          );
        if (url.hostname === "catalog-public-service-prod06.ol.epicgames.com")
          return new Response(
            JSON.stringify({ item: { title: "Orbit Epic QA Game" } }),
          );
        throw new Error("Unexpected QA request");
      };
    });
    const connected = await page.evaluate(() =>
      window.orbit.connectAccount("epic"),
    );
    assert.equal(connected.ok, true);
    let library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.accounts.length, 1);
    assert.equal(library.games[0].name, "Orbit Epic QA Game");
    assert.ok(!JSON.stringify(library).includes("ORBIT_SYNTHETIC_EPIC"));
    const id = library.accounts[0].id;
    const credentialFile = path.join(
      profile,
      "account-credentials",
      `${id}.bin`,
    );
    assert.ok(
      !(await fs.readFile(credentialFile)).includes(
        Buffer.from("ORBIT_SYNTHETIC_EPIC"),
      ),
    );
    await application.evaluate(
      async ({ safeStorage }, { profile, id, modulePath }) => {
        const { CredentialVault } = process.mainModule.require(modulePath);
        const vault = new CredentialVault(profile, safeStorage);
        const value = await vault.read(id);
        value.expiresAt = "2020-01-01T00:00:00Z";
        await vault.write(id, value);
      },
      { profile, id, modulePath: path.resolve("electron/accounts/vault.cjs") },
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.syncAccount(id), id)).ok,
      true,
    );
    const evidence = await application.evaluate(() => globalThis.orbitEpicQa);
    assert.deepEqual(evidence.grants, ["authorization_code", "refresh_token"]);
    assert.equal(evidence.isolated, true);
    assert.equal(
      (await page.evaluate((id) => window.orbit.disconnectAccount(id), id)).ok,
      true,
    );
    library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.accounts.length, 0);
    assert.equal(library.games[0].accountEntitlements[0].state, "disconnected");
    await assert.rejects(fs.access(credentialFile));
    await application.evaluate(() => {
      let started;
      globalThis.orbitQaRequestStarted = new Promise((resolve) => {
        started = resolve;
      });
      globalThis.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
          started(true);
          options.signal.addEventListener(
            "abort",
            () => reject(new Error("Synthetic request aborted")),
            { once: true },
          );
        });
    });
    await page.evaluate(() => {
      window.orbitQaPending = window.orbit.connectAccount("epic");
    });
    await application.evaluate(() => globalThis.orbitQaRequestStarted);
    assert.equal(
      await page.evaluate(() => window.orbit.cancelAccounts()),
      true,
    );
    const cancelled = await page.evaluate(() => window.orbitQaPending);
    assert.equal(cancelled.error.code, "cancelled");
    const afterCancel = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(afterCancel.accounts.length, 0);
    assert.deepEqual(afterCancel.games, library.games);
    console.log(
      JSON.stringify({
        success: true,
        controlledProviderResponses: true,
        connectRefreshDisconnect: true,
        noRendererSecrets: true,
        encryptedStorage: true,
        isolatedAuthWindow: true,
        networkCancellation: true,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
