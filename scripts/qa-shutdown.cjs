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
    await page
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .waitFor();
    await application.evaluate(() => {
      const filesystem = process.mainModule.require("node:fs/promises"),
        original = filesystem.rename;
      globalThis.qaWriteStarted = false;
      filesystem.rename = async (...args) => {
        if (!String(args[1]).endsWith("library.json")) return original(...args);
        filesystem.rename = original;
        globalThis.qaWriteStarted = true;
        await new Promise((resolve) => {
          globalThis.qaReleaseWrite = resolve;
        });
        return original(...args);
      };
    });
    // Electron may destroy the renderer before the IPC reply is delivered;
    // persistence is asserted from disk after the process actually exits.
    const save = page
      .evaluate(() =>
        window.orbit.settings({ closeToTray: false, autoScan: false }),
      )
      .catch((error) => {
        if (
          !/Target page, context or browser has been closed/.test(error.message)
        )
          throw error;
      });
    const deadline = Date.now() + 10000;
    while (!(await application.evaluate(() => globalThis.qaWriteStarted))) {
      if (Date.now() > deadline) throw new Error("Write did not start");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    let closed = false;
    application.on("close", () => {
      closed = true;
    });
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(closed, false, "Close must wait for the pending rename");
    assert.equal(
      await application.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
      1,
    );
    const exit = application.waitForEvent("close");
    await application.evaluate(() => {
      setTimeout(() => globalThis.qaReleaseWrite(), 50);
    });
    await save;
    await exit;
    application = null;
    const saved = JSON.parse(
      await fs.readFile(path.join(profile, "library.json"), "utf8"),
    );
    assert.equal(saved.settings.autoScan, false);
    assert.equal(saved.settings.closeToTray, false);
    application = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const retryPage = await application.firstWindow();
    await retryPage
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .waitFor();
    await application.evaluate(({ dialog }) => {
      const filesystem = process.mainModule.require("node:fs/promises"),
        original = filesystem.rename;
      globalThis.qaSaveErrorShown = false;
      dialog.showErrorBox = (title) => {
        if (title === "No se pudo terminar de guardar")
          globalThis.qaSaveErrorShown = true;
      };
      filesystem.rename = async (...args) => {
        if (!String(args[1]).endsWith("library.json")) return original(...args);
        filesystem.rename = original;
        const error = new Error("QA simulated disk full");
        error.code = "ENOSPC";
        throw error;
      };
    });
    await assert.rejects(
      retryPage.evaluate(() =>
        window.orbit.settings({ minimizeOnLaunch: true }),
      ),
      /QA simulated disk full/,
    );
    await application.evaluate(({ app }) => app.quit());
    const errorDeadline = Date.now() + 10000;
    while (!(await application.evaluate(() => globalThis.qaSaveErrorShown))) {
      if (Date.now() > errorDeadline)
        throw new Error("Missing failed-save close warning");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(
      await application.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
      1,
    );
    await retryPage.evaluate(() =>
      window.orbit.settings({ minimizeOnLaunch: true }),
    );
    const retryExit = application.waitForEvent("close");
    await application.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 50);
    });
    await retryExit;
    application = null;
    const retried = JSON.parse(
      await fs.readFile(path.join(profile, "library.json"), "utf8"),
    );
    assert.equal(retried.settings.minimizeOnLaunch, true);
    console.log(
      JSON.stringify({
        success: true,
        isolatedProfile: true,
        pendingSaveSurvivedWindowClose: true,
        failedSaveKeepsAppOpen: true,
        retrySavedBeforeExit: true,
      }),
    );
  } finally {
    if (application) await application.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
