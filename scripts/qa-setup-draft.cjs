const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

(async () => {
  const root = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const folder = path.join(root, "draft-games");
  await fs.mkdir(folder, { recursive: true });
  const env = {
    ...process.env,
    ORBIT_DATA_DIR: path.join(root, "profile"),
    ORBIT_SKIP_SCAN: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DEV_URL;
  let app;
  const errors = [];
  async function launch() {
    app = await electron.launch({
      executablePath: require("electron"),
      args: [path.resolve(".")],
      env,
    });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .waitFor();
    return page;
  }
  try {
    let page = await launch();
    await app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [selected],
      });
    }, folder);
    await app.evaluate(() => {
      const filesystem = process.mainModule.require("node:fs/promises");
      const rename = filesystem.rename;
      filesystem.rename = async (...args) => {
        if (!String(args[1]).endsWith("library.json")) return rename(...args);
        filesystem.rename = rename;
        throw Object.assign(new Error("QA draft disk full"), {
          code: "ENOSPC",
        });
      };
    });
    await page
      .getByRole("button", { name: "Elegir carpeta de juegos", exact: true })
      .click();
    await page.getByText(/No se pudo guardar el borrador/).waitFor();
    assert.equal(
      await page
        .getByText(/No se pudo guardar el borrador/)
        .evaluate((element) => document.activeElement?.contains(element)),
      true,
    );
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).onboarding.draft,
      undefined,
    );
    await page
      .getByRole("button", { name: "Reintentar guardado", exact: true })
      .click();
    await page
      .getByText("Borrador guardado en este PC", { exact: true })
      .waitFor();
    await app.close();
    app = null;
    page = await launch();
    await page.getByText("Borrador recuperado", { exact: true }).waitFor();
    await page.getByText(folder, { exact: true }).waitFor();
    let library = await page.evaluate(() => window.orbit.getLibrary());
    assert.deepEqual(library.settings.gameFolders, []);
    assert.equal(library.onboarding.completedAt, null);
    assert.equal(library.games.length, 0);
    await page
      .getByRole("button", {
        name: "Descartar borrador y empezar de nuevo",
        exact: true,
      })
      .click();
    await page
      .getByText("Las elecciones se guardarán en este PC.", { exact: true })
      .waitFor();
    assert.equal(await page.getByText(folder, { exact: true }).count(), 0);
    library = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(library.onboarding.draft, undefined);
    await app.close();
    app = null;
    page = await launch();
    assert.equal(await page.getByText(folder, { exact: true }).count(), 0);
    await page.setViewportSize({ width: 1000, height: 760 });
    const heading = await page
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .boundingBox();
    assert.ok(heading.y >= 38, "Heading must stay below the fixed title bar");
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    await fs.mkdir(path.resolve("output/playwright"), { recursive: true });
    await page.screenshot({
      path: path.resolve("output/playwright/next-setup-draft.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        success: true,
        choicesSurviveRestart: true,
        settingsNotApplied: true,
        discardSurvivesRestart: true,
        rendererErrors: errors,
      }),
    );
  } finally {
    if (app) await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
