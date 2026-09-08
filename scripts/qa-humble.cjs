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
  await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(
    path.join(profile, "library.json"),
    JSON.stringify({
      version: 1,
      games: [],
      settings: { autoScan: false },
      onboarding: { completedAt: new Date().toISOString() },
    }),
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
    await application.evaluate(({ app, shell }) => {
      globalThis.orbitHumbleQaOpened = [];
      shell.openExternal = async (url) => {
        globalThis.orbitHumbleQaOpened.push(url);
      };
      app.on("session-created", (isolated) =>
        isolated.protocol.handle("https", (request) => {
          const url = new URL(request.url);
          if (url.hostname !== "www.humblebundle.com")
            return new Response("Blocked QA request", { status: 400 });
          if (url.pathname === "/home/library")
            return new Response(
              '<html><script id="user-home-json-data" type="application/json">{"gamekeys":["private_order_reference"]}</script></html>',
              { headers: { "Content-Type": "text/html" } },
            );
          if (url.pathname === "/api/v1/orders")
            return new Response(
              JSON.stringify({
                private_order_reference: {
                  subproducts: [
                    {
                      machine_name: "sample",
                      human_name: "Humble QA Game",
                      downloads: [
                        { platform: "windows", url: "PRIVATE_DOWNLOAD" },
                      ],
                    },
                  ],
                  tpkd_dict: {
                    all_tpks: [
                      {
                        machine_name: "sample",
                        human_name: "Humble QA Game",
                        key_type: "steam",
                        redeemed_key: "PRIVATE_REDEMPTION",
                      },
                    ],
                  },
                },
              }),
            );
          return new Response("Blocked QA request", { status: 400 });
        }),
      );
    });
    const result = await page.evaluate(() =>
      window.orbit.connectAccount("humble"),
    );
    assert.deepEqual(result, { ok: true, count: 2 });
    const library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.accounts[0].identityVerified, false);
    assert.equal(library.games.length, 2);
    assert.ok(!JSON.stringify(library).includes("PRIVATE"));
    assert.ok(!JSON.stringify(library).includes("private_order_reference"));
    await page
      .locator(".game-card")
      .filter({ hasText: "canje no verificado" })
      .getByRole("button", { name: "Seleccionar Humble QA Game", exact: true })
      .click();
    await page.locator(".account-access-note").waitFor();
    await page
      .getByRole("button", { name: "Ver biblioteca web", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(() => globalThis.orbitHumbleQaOpened),
      ["https://www.humblebundle.com/home/library"],
    );
    await page.screenshot({
      path: path.resolve("output/playwright/next-humble.png"),
      animations: "disabled",
    });
    assert.equal(
      (
        await page.evaluate(
          (id) => window.orbit.disconnectAccount(id),
          library.accounts[0].id,
        )
      ).ok,
      true,
    );
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).games.length,
      2,
    );
    console.log(
      JSON.stringify({
        success: true,
        controlledProviderResponses: true,
        noRedemptionCodesPersisted: true,
        downloadAndKeySeparated: true,
        sessionIdentityDisclosed: true,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
