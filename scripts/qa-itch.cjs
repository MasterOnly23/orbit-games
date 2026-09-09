const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    randomUUID(),
  );
  const env = {
    ...process.env,
    ORBIT_DATA_DIR: profile,
    ORBIT_SKIP_SCAN: "1",
    ORBIT_ITCH_CLIENT_ID: "orbit-synthetic-client",
  };
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
    assert.ok(
      (await page.evaluate(() => window.orbit.accountProviders())).some(
        (provider) => provider.id === "itch",
      ),
    );
    await application.evaluate(({ app }) => {
      app.on("session-created", (isolated) =>
        isolated.protocol.handle("https", (request) => {
          const state = new URL(request.url).searchParams.get("state");
          const callback = `http://127.0.0.1:43817/orbit/itch/callback?code=orbit-synthetic-code&state=${state}`;
          return new Response(
            `<html><script>location.href=${JSON.stringify(callback)}</script></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
        }),
      );
      globalThis.fetch = async (address) => {
        const url = new URL(address);
        if (url.pathname === "/oauth/token")
          return new Response(
            JSON.stringify({
              access_token: "ORBIT_SYNTHETIC_ITCH_ACCESS",
              refresh_token: "ORBIT_SYNTHETIC_ITCH_REFRESH",
              expires_in: 3600,
            }),
          );
        if (url.pathname === "/profile")
          return new Response(
            JSON.stringify({ user: { id: 123, username: "Itch QA" } }),
          );
        if (url.pathname === "/profile/owned-keys")
          return new Response(
            JSON.stringify({
              page: 1,
              per_page: 100,
              owned_keys: [
                {
                  id: 321,
                  owner_id: 123,
                  game_id: 456,
                  key: "ORBIT_SYNTHETIC_DOWNLOAD_KEY",
                  game: {
                    id: 456,
                    title: "Itch QA Game",
                    classification: "game",
                  },
                },
              ],
            }),
          );
        throw new Error("Unexpected QA request");
      };
    });
    assert.deepEqual(
      await page.evaluate(() => window.orbit.connectAccount("itch")),
      { ok: true, count: 1 },
    );
    let state = await page.evaluate(() => window.orbit.getLibrary());
    assert.ok(!JSON.stringify(state).includes("ORBIT_SYNTHETIC"));
    assert.equal(state.games[0].provider, "itch.io");
    const id = state.accounts[0].id,
      file = path.join(profile, "account-credentials", `${id}.bin`);
    assert.ok(
      !(await fs.readFile(file)).includes(Buffer.from("ORBIT_SYNTHETIC")),
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.syncAccount(id), id)).ok,
      true,
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.disconnectAccount(id), id)).ok,
      true,
    );
    await assert.rejects(fs.access(file));
    state = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(state.accounts.length, 0);
    assert.equal(state.games.length, 1);
    console.log(
      JSON.stringify({
        success: true,
        controlledResponses: true,
        realAuthWindowCallback: true,
        encryptedStorage: true,
        noDownloadKeysInLibrary: true,
        connectSyncDisconnect: true,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
