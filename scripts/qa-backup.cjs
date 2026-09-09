const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { LibraryStore } = require("../electron/library/store.cjs");

(async () => {
  const root = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const id = "c".repeat(20),
    source = new LibraryStore(path.join(root, "source"));
  await source.load();
  source.data.onboarding.completedAt = new Date().toISOString();
  source.data.games = [
    {
      id,
      name: "Backup QA Game",
      provider: "Manual",
      manual: true,
      launch: { kind: "file", target: "Z:\\Missing\\Game.exe" },
      launchOptions: {
        args: ["--profile", "QA profile"],
        workingDirectory: "Z:\\Missing",
      },
      sources: [],
      status: "unknown",
      favorite: true,
      notes: "Keep this note",
      artworkRevision: 1,
    },
  ];
  source.data.settings.autoScan = false;
  await source.save();
  const copy = path.join(root, "portable.json");
  let application;
  const errors = [];
  async function launch(directory) {
    const env = {
      ...process.env,
      ORBIT_DATA_DIR: directory,
      ORBIT_SKIP_SCAN: "1",
    };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ORBIT_DEV_URL;
    application = await electron.launch({
      executablePath: process.env.ORBIT_TEST_EXE || require("electron"),
      args: process.env.ORBIT_TEST_EXE ? [] : [path.resolve(".")],
      env,
    });
    const page = await application.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => !!window.orbit);
    return page;
  }
  try {
    let page = await launch(source.directory);
    const jpeg = await application.evaluate(({ nativeImage }) =>
      Array.from(
        nativeImage
          .createFromBuffer(Buffer.from([0, 0, 255, 255]), {
            width: 1,
            height: 1,
          })
          .toJPEG(88),
      ),
    );
    await fs.mkdir(path.join(source.directory, "artwork"));
    await fs.writeFile(
      path.join(source.directory, "artwork", `${id}.jpg`),
      Buffer.from(jpeg),
    );
    await application.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, copy);
    assert.equal(await page.evaluate(() => window.orbit.exportLibrary()), true);
    await application.close();
    application = null;
    const target = new LibraryStore(path.join(root, "target"));
    await target.load();
    target.data.onboarding.completedAt = new Date().toISOString();
    target.data.settings.autoScan = false;
    await target.save();
    page = await launch(target.directory);
    await application.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
      dialog.showMessageBox = async () => ({ response: 0 });
    }, copy);
    assert.equal(
      await page.evaluate(() => window.orbit.importLibrary()),
      false,
    );
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).games.length,
      0,
    );
    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    assert.equal(await page.evaluate(() => window.orbit.importLibrary()), 1);
    await application.close();
    application = null;
    page = await launch(target.directory);
    const state = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(state.games[0].notes, "Keep this note");
    assert.equal(state.games[0].status, "unknown");
    assert.deepEqual(state.games[0].launchOptions.args, [
      "--profile",
      "QA profile",
    ]);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[src^="orbit-art:"]')].some(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    if (!process.env.ORBIT_TEST_EXE) {
      const diagnosticFile = path.join(root, "diagnostic.json");
      await application.evaluate(({ dialog }) => {
        dialog.showSaveDialog = async () => ({ canceled: true });
      });
      await page
        .getByRole("button", { name: "Exportar diagnóstico", exact: true })
        .click();
      await page.getByText("Exportación cancelada", { exact: true }).waitFor();
      await assert.rejects(fs.access(diagnosticFile));
      await application.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: file,
        });
      }, diagnosticFile);
      await page
        .getByRole("button", { name: "Exportar diagnóstico", exact: true })
        .click();
      await page
        .getByText("Diagnóstico guardado en tu PC", { exact: true })
        .waitFor();
      const diagnostic = JSON.parse(await fs.readFile(diagnosticFile, "utf8"));
      assert.equal(diagnostic.library.total, 1);
      assert.equal(
        diagnostic.application.version,
        require("../package.json").version,
      );
      const serialized = JSON.stringify(diagnostic);
      for (const privateValue of [
        root,
        "Backup QA Game",
        "Keep this note",
        "QA profile",
        "Missing",
      ])
        assert.ok(!serialized.includes(privateValue));
      assert.equal(
        (await page.evaluate(() => window.orbit.getLibrary())).games[0].notes,
        "Keep this note",
      );
    }

    await page
      .getByRole("button", { name: "Exportar biblioteca", exact: true })
      .scrollIntoViewIfNeeded();
    await fs.mkdir(path.resolve("output/playwright"), { recursive: true });
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    await page.screenshot({
      path: path.resolve("output/playwright/next-backup-settings.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        success: true,
        separateProfiles: true,
        cancelledRestoreUnchanged: true,
        manualGameRestored: true,
        artworkRenderedAfterRestart: true,
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
