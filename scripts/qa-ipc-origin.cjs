const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");

(async () => {
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Controlled Orbit IPC fixture</title>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const env = {
    ...process.env,
    ORBIT_DATA_DIR: profile,
    ORBIT_SKIP_SCAN: "1",
    ORBIT_DEV_URL: `${base}/app`,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  let application;
  try {
    application = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const page = await application.firstWindow();
    await page.waitForLoadState();
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).appName,
      "Orbit Games Next",
    );
    const otherWindowResult = await application.evaluate(
      async ({ BrowserWindow }, url) => {
        const other = new BrowserWindow({
          show: false,
          webPreferences: {
            preload: process.mainModule
              .require("node:path")
              .resolve("electron/preload.cjs"),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        try {
          await other.loadURL(url);
          return await other.webContents.executeJavaScript(
            "window.orbit.getLibrary().then(() => 'unexpected success', error => error.message)",
          );
        } finally {
          other.destroy();
        }
      },
      `${base}/app`,
    );
    assert.match(otherWindowResult, /Origen no autorizado/);
    // Force navigation from the QA main process to test the IPC guard itself,
    // independently of the additional renderer-navigation restriction.
    await application.evaluate(async ({ BrowserWindow }, url) => {
      await BrowserWindow.getAllWindows()[0].loadURL(url);
    }, `${base}/application`);
    assert.match(
      await page.evaluate(() =>
        window.orbit.getLibrary().then(
          () => "unexpected success",
          (error) => error.message,
        ),
      ),
      /Origen no autorizado/,
    );
    console.log(
      JSON.stringify({
        success: true,
        isolatedProfile: true,
        legitimateMainFrameAllowed: true,
        sameDocumentOtherWindowDenied: true,
        prefixedPathDenied: true,
      }),
    );
  } finally {
    if (application) await application.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
