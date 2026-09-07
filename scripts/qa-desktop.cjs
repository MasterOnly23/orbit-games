const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { LibraryStore } = require("../electron/library/store.cjs");
const { scanLibrary } = require("../electron/library/scanner.cjs");
const { mergeGames } = require("../electron/library/model.cjs");
const waitFor = async (check, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Verification timed out");
};
(async () => {
  const output = path.resolve("output/playwright");
  await fs.mkdir(output, { recursive: true });
  const data = path.resolve(".test-data/desktop-qa");
  await fs.mkdir(data, { recursive: true });
  const watched = path.resolve(".test-data/watched");
  await fs.mkdir(watched, { recursive: true });
  const scan = await scanLibrary(
    [path.join(process.env.USERPROFILE, "Desktop", "Games")],
    path.resolve("electron/platform/inventory.ps1"),
  );
  const store = new LibraryStore(data, process.env.USERPROFILE);
  store.data.games = mergeGames(scan.games);
  store.data.settings = {
    ...store.data.settings,
    folders: [watched],
    onlineMetadata: false,
    autoScan: false,
  };
  store.data.scannedAt = scan.scannedAt;
  await store.save();
  const env = { ...process.env, ORBIT_DATA_DIR: data, ORBIT_SKIP_SCAN: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const launchOptions = process.env.ORBIT_TEST_EXE
    ? { executablePath: process.env.ORBIT_TEST_EXE, args: [], env }
    : { args: ["."], env };
  let application;
  const errors = [],
    checks = [];
  try {
    application = await electron.launch(launchOptions);
    const page = await application.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForSelector(".game-grid");
    const initial = await page.evaluate(() => window.orbit.getLibrary());
    assert(initial.games.length > 90);
    checks.push(`Live inventory: ${initial.games.length} entries`);
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Cyberpunk");
    assert.equal(await page.locator(".game-card").count(), 1);
    await page
      .getByRole("button", { name: "Seleccionar Cyberpunk 2077", exact: true })
      .click();
    assert.equal(
      await page.locator(".hero-content h1").innerText(),
      "Cyberpunk 2077",
    );
    checks.push("Search and selection");
    await page
      .getByRole("button", { name: "Marcar favorito", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Editar juego", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Mis notas", exact: true })
      .fill("Persistencia verificada");
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    const cyberId = initial.games.find((g) => g.steamId === "1091500").id;
    let saved = await page.evaluate(
      (id) =>
        window.orbit.getLibrary().then((s) => s.games.find((g) => g.id === id)),
      cyberId,
    );
    assert(saved.favorite);
    assert.equal(saved.notes, "Persistencia verificada");
    checks.push("Favorite and notes saved");
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const initialStartup = await page
      .getByRole("switch", { name: "Abrir al iniciar Windows", exact: true })
      .isChecked();
    try {
      await page
        .getByRole("switch", { name: "Abrir al iniciar Windows", exact: true })
        .click();
      await waitFor(() =>
        page.evaluate(
          (value) =>
            window.orbit
              .getLibrary()
              .then((s) => s.settings.startWithWindows === value),
          !initialStartup,
        ),
      );
      checks.push("Accessible startup switch changes the real Windows setting");
    } finally {
      await page.evaluate(
        (value) => window.orbit.settings({ startWithWindows: value }),
        initialStartup,
      );
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(output, "settings.png") });
    await page.getByRole("button", { name: "Listo", exact: true }).click();
    // Native file picker returns our own harmless executable; real IPC and Windows launch remain active.
    const fixture = path.resolve("output/launch-fixture.exe");
    await fs.rm(path.resolve("output/launch-proof.txt"), { force: true });
    await application.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, fixture);
    await page
      .getByRole("button", { name: "Añadir juego", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Elegir archivo", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Nombre del juego", exact: true })
      .fill("Orbit Launch Verification");
    await page
      .getByRole("button", { name: "Añadir a mi biblioteca", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Orbit Launch Verification");
    await page
      .getByRole("button", {
        name: "Seleccionar Orbit Launch Verification",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Jugar ahora", exact: true })
      .click();
    await waitFor(() =>
      fs.access(path.resolve("output/launch-proof.txt")).then(
        () => true,
        () => false,
      ),
    );
    assert(
      (
        await fs.readFile(path.resolve("output/launch-proof.txt"), "utf8")
      ).includes(path.dirname(fixture)),
    );
    checks.push(
      "Manual executable: real process, proof file and correct working directory",
    );
    const manual = await page.evaluate(() =>
      window.orbit
        .getLibrary()
        .then((s) =>
          s.games.find((g) => g.name === "Orbit Launch Verification"),
        ),
    );
    assert(manual.lastPlayed);
    assert.equal(manual.launchCount, 1);
    checks.push("Launch history");
    await page.evaluate(() => window.orbit.settings({ onlineMetadata: true }));
    await page.evaluate((id) => window.orbit.metadataRefresh(id), cyberId);
    saved = await page.evaluate(
      (id) =>
        window.orbit.getLibrary().then((s) => s.games.find((g) => g.id === id)),
      cyberId,
    );
    assert.equal(saved.metadata.title, "Cyberpunk 2077");
    checks.push("Live Steam metadata");
    await page.evaluate(() => window.orbit.settings({ onlineMetadata: false }));
    await application.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, path.resolve("assets/icon.png"));
    await page.evaluate((id) => window.orbit.chooseArtwork(id), manual.id);
    await page.waitForFunction(
      () =>
        document.querySelector(".hero-art img")?.src.startsWith("orbit-art:") &&
        document.querySelector(".hero-art img")?.naturalWidth > 0,
    );
    checks.push("Local artwork through restricted image protocol");
    await page.evaluate((id) => window.orbit.clearArtwork(id), manual.id);
    // Verify actual login-item registration and restore its original value immediately.
    const before = await page.evaluate(() =>
      window.orbit.getLibrary().then((s) => s.settings.startWithWindows),
    );
    try {
      const enabled = await page.evaluate(() =>
        window.orbit.settings({ startWithWindows: true }),
      );
      assert(enabled.settings.startWithWindows);
      checks.push("Windows login item enabled and read back");
    } finally {
      await page.evaluate(
        (value) => window.orbit.settings({ startWithWindows: value }),
        before,
      );
    }
    // A new URL dropped into the watched folder must appear without a manual scan.
    await page.evaluate(() => window.orbit.settings({ autoScan: true }));
    await waitFor(() =>
      page.evaluate(() => window.orbit.getLibrary().then((s) => !s.scanning)),
    );
    const added = path.join(watched, "Orbit Watch Verification.url");
    await fs.writeFile(
      added,
      "[InternetShortcut]\r\nURL=steam://rungameid/999999991\r\n",
    );
    await waitFor(
      () =>
        page.evaluate(() =>
          window.orbit
            .getLibrary()
            .then((s) =>
              s.games.some((g) => g.name === "Orbit Watch Verification"),
            ),
        ),
      45000,
    );
    checks.push("Automatic folder detection");
    await fs.unlink(added);
    await page.evaluate(() => window.orbit.settings({ autoScan: false }));
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Cyberpunk");
    await page
      .getByRole("button", { name: "Seleccionar Cyberpunk 2077", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("");
    await page.screenshot({ path: path.join(output, "library-verified.png") });
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 720),
    );
    await page.screenshot({ path: path.join(output, "library-1000.png") });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false);
    checks.push("Minimum window layout");
    assert.equal(errors.length, 0);
    checks.push("No renderer exceptions");
    await application.close();
    application = null;
    application = await electron.launch(launchOptions);
    const reopened = await application.firstWindow();
    await reopened.waitForSelector(".game-grid");
    const persisted = await reopened.evaluate(
      (id) =>
        window.orbit.getLibrary().then((s) => s.games.find((g) => g.id === id)),
      cyberId,
    );
    assert.equal(persisted.notes, "Persistencia verificada");
    assert(persisted.favorite);
    checks.push("Persistence across full restart");
    console.log(JSON.stringify({ passed: true, checks, errors }, null, 2));
    await fs.writeFile(
      path.join(output, "qa-results.json"),
      JSON.stringify({ passed: true, checks, errors }, null, 2),
    );
  } finally {
    if (application) await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
