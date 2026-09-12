const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { LibraryStore } = require("../electron/library/store.cjs");
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
  let app;
  try {
    const store = new LibraryStore(profile);
    await store.load();
    store.data.games = [
      {
        id: "a".repeat(20),
        name: "Locale QA Game",
        provider: "Otros",
        manual: true,
        sources: [],
        launch: { kind: "uri", target: "steam://rungameid/987603" },
        metadata: {
          steamId: "987603",
          title: "Original",
          description: "Old description",
        },
        tags: [],
      },
    ];
    store.data.onboarding.completedAt = new Date().toISOString();
    store.data.settings.autoScan = false;
    await store.save();
    const launch = () =>
      electron.launch({
        executablePath: require("electron"),
        args: [path.resolve(".")],
        env,
      });
    app = await launch();
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Idioma de las fichas", exact: true })
      .click();
    await page.getByRole("option", { name: "English", exact: true }).click();
    await page.getByLabel("Región de consulta", { exact: true }).fill("us");
    await page
      .getByRole("button", { name: "Guardar idioma y región", exact: true })
      .click();
    await page
      .getByText("Preferencias de fichas guardadas", { exact: true })
      .waitFor();
    const saved = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(saved.settings.metadataLanguage, "english");
    assert.equal(saved.settings.metadataCountry, "US");
    assert.equal(saved.settings.onlineMetadata, false);
    await fs.mkdir("output/playwright", { recursive: true });
    await page
      .getByLabel("Región de consulta", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "output/playwright/next-metadata-locale.png",
    });
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    const rendererErrors = [];
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const restored = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(restored.settings.metadataLanguage, "english");
    assert.equal(restored.settings.metadataCountry, "US");
    await assert.rejects(
      page.evaluate(() =>
        window.orbit.settings({
          metadataCountry: "INVALID",
          onlineMetadata: true,
        }),
      ),
    );
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).settings
        .onlineMetadata,
      false,
    );
    await app.evaluate(() => {
      globalThis.qaMetadataUrls = [];
      globalThis.fetch = async (url) => {
        globalThis.qaMetadataUrls.push(url);
        const request = new URL(url),
          id = request.searchParams.get("appids");
        return {
          ok: true,
          json: async () =>
            id
              ? {
                  [id]: {
                    data: {
                      name: "Localized title",
                      short_description: "Updated in English",
                    },
                  },
                }
              : { items: [] },
        };
      };
    });
    await page.evaluate(() => window.orbit.settings({ onlineMetadata: true }));
    await page.evaluate(() => window.orbit.metadataSearch("Fixture query"));
    const urls = await app.evaluate(() => globalThis.qaMetadataUrls);
    assert.equal(urls.length, 1);
    const request = new URL(urls[0]);
    assert.equal(request.searchParams.get("l"), "english");
    assert.equal(request.searchParams.get("cc"), "US");
    await page.getByTitle("Editar juego y ficha", { exact: true }).click();
    const refreshButton = page.getByRole("button", {
      name: "Actualizar ficha", exact: true,
    });
    await refreshButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "output/playwright/next-metadata-refresh.png" });
    await refreshButton.click();
    await page.getByText("Ficha actualizada", { exact: true }).waitFor();
    const refreshed = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(refreshed.games[0].metadata.description, "Updated in English");
    const refreshUrls = await app.evaluate(() => globalThis.qaMetadataUrls);
    assert.equal(refreshUrls.length, 2);
    assert.equal(new URL(refreshUrls[1]).searchParams.get("appids"), "987603");
    assert.equal(new URL(refreshUrls[1]).searchParams.get("l"), "english");
    assert.equal(new URL(refreshUrls[1]).searchParams.get("cc"), "US");
    assert.deepEqual(rendererErrors, []);
    console.log(
      JSON.stringify({
        success: true,
        preferencesPersistAfterRestart: true,
        invalidPreferencesDoNotEnableNetwork: true,
        metadataRequestUsesSavedLocale: true,
        controlledResponse: true,
        refreshButtonUsesLinkedGameAndLocale: true,
      }),
    );
  } finally {
    if (app) await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
