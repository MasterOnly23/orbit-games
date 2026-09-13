const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { LibraryStore } = require("../electron/library/store.cjs");

(async () => {
  const root = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const store = new LibraryStore(root);
  await store.load();
  store.data.onboarding.completedAt = new Date().toISOString();
  store.data.settings.autoScan = false;
  await store.save();
  const env = { ...process.env, ORBIT_DATA_DIR: root, ORBIT_SKIP_SCAN: "1" };
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
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1000, height: 760 });
    await page.context().setOffline(true);
    await application.evaluate(({ shell }) => {
      globalThis.supportCalls = [];
      shell.openExternal = async (url) => {
        globalThis.supportCalls.push(url);
      };
    });
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const topic = page
      .locator("summary")
      .filter({ hasText: "No aparece un juego" });
    await topic.focus();
    await page.keyboard.press("Enter");
    assert.equal(await topic.evaluate((el) => el.parentElement.open), true);
    await page
      .getByText("No hace falta conectar una cuenta", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Abrir reportes en GitHub", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.activeElement?.textContent?.includes("Abrir reportes"),
    );
    let calls = [];
    for (let attempt = 0; attempt < 50; attempt++) {
      calls = await application.evaluate(() => globalThis.supportCalls);
      if (calls.length) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.deepEqual(calls, [
      "https://github.com/MasterOnly23/orbit-games/issues",
    ]);
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await fs.mkdir(path.resolve("output/playwright"), { recursive: true });
    await page
      .getByText("Ayuda y soporte", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    await page.screenshot({
      path: path.resolve("output/playwright/next-help.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        success: true,
        offlineHelp: true,
        keyboardDisclosure: true,
        fixedSupportUrl: true,
        rendererErrors: errors,
      }),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
