const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
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
      const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        spaceId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      const session = {
        userId,
        nameOnPlatform: "Ubisoft QA",
        ticket: "ORBIT_SYNTHETIC_UBI_TICKET",
        sessionId: "ORBIT_SYNTHETIC_UBI_SESSION",
      };
      globalThis.orbitUbiQaRenewals = 0;
      app.on("session-created", (isolated) =>
        isolated.protocol.handle(
          "https",
          () =>
            new Response(
              `<html><script>localStorage.setItem('PRODloginData', ${JSON.stringify(JSON.stringify(session))})</script></html>`,
              { headers: { "Content-Type": "text/html" } },
            ),
        ),
      );
      globalThis.fetch = async (address) => {
        const url = new URL(address);
        if (url.pathname === "/v3/profiles/sessions") {
          globalThis.orbitUbiQaRenewals++;
          return new Response(JSON.stringify(session));
        }
        if (url.pathname.endsWith("/entitlements"))
          return new Response(
            JSON.stringify({
              entitlements: [
                {
                  spaceId,
                  productId: "123",
                  accessLevel: "owned",
                  type: "game",
                  availability: "available",
                },
              ],
            }),
          );
        if (url.pathname.endsWith("/graphql"))
          return new Response(
            JSON.stringify({
              data: {
                games: [
                  {
                    spaceId,
                    name: "Ubisoft QA Game",
                    platform: { type: "PC" },
                  },
                ],
              },
            }),
          );
        throw new Error("Unexpected QA request");
      };
    });
    assert.deepEqual(
      await page.evaluate(() => window.orbit.connectAccount("ubisoft")),
      { ok: true, count: 1 },
    );
    const library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.games[0].providerId, "123");
    assert.ok(!JSON.stringify(library).includes("ORBIT_SYNTHETIC_UBI"));
    const id = library.accounts[0].id,
      file = path.join(profile, "account-credentials", `${id}.bin`);
    assert.ok(
      !(await fs.readFile(file)).includes(Buffer.from("ORBIT_SYNTHETIC_UBI")),
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.syncAccount(id), id)).ok,
      true,
    );
    assert.equal(
      await application.evaluate(() => globalThis.orbitUbiQaRenewals),
      2,
    );
    assert.equal(
      (await page.evaluate((id) => window.orbit.disconnectAccount(id), id)).ok,
      true,
    );
    await assert.rejects(fs.access(file));
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).games.length,
      1,
    );
    console.log(
      JSON.stringify({
        success: true,
        controlledProviderResponses: true,
        connectRenewDisconnect: true,
        noRendererSecrets: true,
        encryptedStorage: true,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
