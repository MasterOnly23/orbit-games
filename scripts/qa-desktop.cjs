const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

async function waitForLibrary(page, predicate, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (true) {
    const library = await page.evaluate(() => window.orbit.getLibrary());
    if (predicate(library)) return library;
    if (Date.now() >= deadline) throw new Error("Library state wait timed out");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

(async () => {
  const output = path.resolve("output/playwright");
  await fs.mkdir(output, { recursive: true });
  const profile = path.join(
    process.env.APPDATA,
    "Orbit Games Next",
    "qa",
    crypto.randomUUID(),
  );
  const fixture = path.join(profile, "fixture-games");
  await fs.mkdir(fixture, { recursive: true });
  await fs.writeFile(
    path.join(fixture, "Orbit QA Adventure.exe"),
    "Non executable QA fixture. Never launched.",
  );
  await fs.writeFile(path.join(fixture, "unins000.exe"), "Not a game.");
  const env = { ...process.env, ORBIT_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_SKIP_SCAN;
  delete env.ORBIT_DEV_URL;
  const fromSource = process.argv.includes("--source");
  const executable = fromSource
    ? require("electron")
    : process.env.ORBIT_TEST_EXE ||
      path.resolve(
        require("../package.json").build.directories.output,
        "win-unpacked/Orbit Games Next.exe",
      );
  const launchArgs = fromSource ? [path.resolve(".")] : [];
  const errors = [];
  const remoteRequests = [];
  const observe = (page) => {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) remoteRequests.push(r.url());
    });
  };
  let application;
  try {
    application = await electron.launch({
      executablePath: executable,
      args: launchArgs,
      env,
    });
    let page = await application.firstWindow();
    observe(page);
    await page
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .waitFor();
    const runtime = await application.evaluate(({ app }) => ({
      name: app.getName(),
      version: app.getVersion(),
      userData: app.getPath("userData"),
      sessionData: app.getPath("sessionData"),
    }));
    assert.equal(runtime.name, "Orbit Games Next");
    assert.equal(runtime.version, require("../package.json").version);
    assert.equal(runtime.userData, profile);
    assert.equal(runtime.sessionData, profile);
    const initial = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(initial.games.length, 0);
    assert.equal(initial.scanning, false);
    await page.screenshot({ path: path.join(output, "next-setup.png") });
    await application.evaluate(({ dialog }, folder) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async (...args) => {
        dialog.showOpenDialog = original;
        if (args.at(-1).properties[0] !== "openDirectory")
          throw new Error("Unexpected dialog");
        return { canceled: false, filePaths: [folder] };
      };
    }, fixture);
    await page
      .getByRole("button", { name: "Elegir carpeta de juegos", exact: true })
      .click();
    if (fromSource) {
      await application.evaluate((_electron, folder) => {
        const filesystem = process.mainModule.require("node:fs/promises");
        const original = filesystem.readdir;
        globalThis.orbitSetupQaWaiting = false;
        filesystem.readdir = async (...args) => {
          if (String(args[0]).toLowerCase() !== folder.toLowerCase())
            return original(...args);
          filesystem.readdir = original;
          globalThis.orbitSetupQaWaiting = true;
          await new Promise((resolve) => {
            globalThis.orbitSetupQaRelease = resolve;
          });
          return original(...args);
        };
      }, fixture);
      await page
        .getByRole("button", { name: "Buscar juegos", exact: true })
        .click();
      const deadline = Date.now() + 90000;
      while (
        !(await application.evaluate(() => globalThis.orbitSetupQaWaiting))
      ) {
        if (Date.now() > deadline)
          throw new Error("Setup did not reach controlled folder read");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await page
        .getByRole("button", { name: "Detener búsqueda", exact: true })
        .click();
      await page
        .getByText(
          "Búsqueda detenida. Puedes ajustar las carpetas y volver a buscar. No se guardaron juegos.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        (await page.evaluate(() => window.orbit.getLibrary())).games.length,
        0,
      );
      await application.evaluate(() => globalThis.orbitSetupQaRelease());
    }
    await page
      .getByRole("button", { name: "Buscar juegos", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Revisa tu biblioteca" })
      .waitFor({ timeout: 120000 });
    const checkbox = page.getByRole("checkbox", {
      name: "Añadir Orbit QA Adventure",
      exact: true,
    });
    await checkbox.check();
    assert.equal(
      await page.getByRole("checkbox", { name: /unins000/ }).count(),
      0,
    );
    await page.screenshot({ path: path.join(output, "next-review.png") });
    await page.setViewportSize({ width: 1000, height: 700 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page
      .getByRole("button", { name: "Continuar a cuentas", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Tus cuentas, si las necesitas",
        exact: true,
      })
      .waitFor();
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).accounts.length,
      0,
    );
    await page.screenshot({
      path: path.join(output, "next-setup-accounts.png"),
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Guardar y abrir biblioteca", exact: true })
      .click();
    await page.waitForSelector(".game-grid");
    const saved = await page.evaluate(() => window.orbit.getLibrary());
    assert.ok(saved.onboarding.completedAt);
    assert.ok(
      saved.games.some((g) => g.name === "Orbit QA Adventure" && g.manual),
    );
    assert.equal(saved.settings.onlineMetadata, false);
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Orbit QA Adventure");
    await page
      .getByRole("button", {
        name: "Seleccionar Orbit QA Adventure",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Editar juego", exact: true })
      .click();
    await application.evaluate(({ dialog }, file) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async (...args) => {
        dialog.showOpenDialog = original;
        if (args.at(-1).title !== "Selecciona una imagen para el juego")
          throw new Error("Unexpected image picker");
        return { canceled: false, filePaths: [file] };
      };
    }, path.resolve("assets/icon.png"));
    await page
      .getByRole("button", { name: "Usar una imagen de mi PC", exact: true })
      .click();
    await waitForLibrary(
      page,
      (library) =>
        library.games.find((g) => g.name === "Orbit QA Adventure")
          ?.artworkRevision,
    );
    await page
      .getByText("Opciones del ejecutable o lanzador propio", { exact: true })
      .click();
    await page
      .getByLabel("Argumentos de inicio", { exact: true })
      .fill("--profile\nQA profile with spaces");
    await page.getByLabel("Carpeta de trabajo", { exact: true }).fill(fixture);
    await page
      .getByRole("combobox", { name: "Mi progreso", exact: true })
      .click();
    await page.getByRole("option", { name: "Jugando", exact: true }).click();
    if (fromSource)
      await page
        .getByLabel("Mis etiquetas", { exact: true })
        .fill("Cooperativo\nCon amigos\ncooperativo");
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector(".hero-art img")?.naturalWidth > 0,
    );
    await application.close();
    application = null;
    application = await electron.launch({
      executablePath: executable,
      args: launchArgs,
      env,
    });
    page = await application.firstWindow();
    observe(page);
    await page.waitForSelector(".game-grid", { timeout: 90000 });
    await waitForLibrary(page, (library) => !library.scanning);
    assert.equal(
      await page
        .getByRole("heading", { name: "Tus juegos empiezan aquí" })
        .count(),
      0,
    );
    const restored = await page.evaluate(() => window.orbit.getLibrary());
    if (fromSource)
      assert.deepEqual(
        restored.games.find((g) => g.name === "Orbit QA Adventure").tags,
        ["Cooperativo", "Con amigos"],
      );
    assert.deepEqual(
      restored.games.find((g) => g.name === "Orbit QA Adventure").launchOptions,
      {
        args: ["--profile", "QA profile with spaces"],
        workingDirectory: fixture,
      },
    );
    const variantIds = await page.evaluate(
      async (target) => {
        const first = await window.orbit.addGame({
          name: "QA variant upper",
          target,
          launchOptions: { args: ["A"], workingDirectory: "" },
        });
        const second = await window.orbit.addGame({
          name: "QA variant lower",
          target,
          launchOptions: { args: ["a"], workingDirectory: "" },
        });
        return [first, second];
      },
      path.join(fixture, "Orbit QA Adventure.exe"),
    );
    assert.notEqual(
      variantIds[0],
      variantIds[1],
      "Arguments remain case sensitive when identifying launcher variants",
    );
    assert.ok(
      restored.games.some((g) => g.name === "Orbit QA Adventure" && g.manual),
    );
    assert.equal(restored.onboarding.completedAt, saved.onboarding.completedAt);
    assert.ok(
      restored.games.find((g) => g.name === "Orbit QA Adventure")
        .artworkRevision,
    );
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Orbit QA Adventure");
    await page
      .getByRole("button", {
        name: "Seleccionar Orbit QA Adventure",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () => document.querySelector(".hero-art img")?.naturalWidth > 0,
    );
    assert.ok(
      await page
        .locator(".hero-art img")
        .getAttribute("src")
        .then((src) => src.startsWith("orbit-art:")),
    );
    if (fromSource) {
      await page.evaluate(() => window.orbit.settings({ autoScan: false }));
      await waitForLibrary(page, (library) => !library.scanning);
      const beforeCancel = await page.evaluate(() => window.orbit.getLibrary());
      await application.evaluate((_electron, folder) => {
        const filesystem = process.mainModule.require("node:fs/promises"),
          original = filesystem.readdir;
        globalThis.orbitLibraryQaWaiting = false;
        filesystem.readdir = async (...args) => {
          if (String(args[0]).toLowerCase() !== folder.toLowerCase())
            return original(...args);
          filesystem.readdir = original;
          globalThis.orbitLibraryQaWaiting = true;
          await new Promise((resolve) => {
            globalThis.orbitLibraryQaRelease = resolve;
          });
          return original(...args);
        };
      }, fixture);
      await page
        .getByRole("button", { name: "Detectar juegos nuevos", exact: true })
        .click();
      const deadline = Date.now() + 90000;
      while (
        !(await application.evaluate(() => globalThis.orbitLibraryQaWaiting))
      ) {
        if (Date.now() > deadline)
          throw new Error("Library scan did not reach controlled folder read");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await page
        .getByRole("button", { name: "Detener detección", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Detectar juegos nuevos", exact: true })
        .waitFor();
      const afterCancel = await page.evaluate(() => window.orbit.getLibrary());
      assert.deepEqual(afterCancel.games, beforeCancel.games);
      assert.equal(afterCancel.scannedAt, beforeCancel.scannedAt);
      assert.deepEqual(afterCancel.discovery, beforeCancel.discovery);
      await application.evaluate(() => globalThis.orbitLibraryQaRelease());
    }
    await fs.writeFile(
      path.join(fixture, "Orbit QA New Arrival.exe"),
      "Non executable QA fixture. Never launched.",
    );
    await page.evaluate(() => window.orbit.scan());
    const discovered = await page.evaluate(() => window.orbit.getLibrary());
    assert.ok(
      discovered.discovery.candidates.some(
        (candidate) => candidate.name === "Orbit QA New Arrival",
      ),
    );
    assert.ok(
      !discovered.games.some((game) => game.name === "Orbit QA New Arrival"),
      "Discovery must require confirmation",
    );
    await page.getByRole("button", { name: "Revisar", exact: true }).waitFor();
    assert.equal(
      discovered.games.find((game) => game.name === "Orbit QA Adventure")
        .playStatus,
      "playing",
    );
    await page
      .getByRole("combobox", { name: "Filtrar por progreso" })
      .selectOption("completed");
    assert.equal(
      await page
        .getByRole("button", {
          name: "Seleccionar Orbit QA Adventure",
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByRole("combobox", { name: "Filtrar por progreso" })
      .selectOption("playing");
    await page
      .getByRole("button", {
        name: "Seleccionar Orbit QA Adventure",
        exact: true,
      })
      .waitFor();
    await page.setViewportSize({ width: 1000, height: 700 });
    if (fromSource) {
      const tagged = discovered.games.find(
        (g) => g.name === "Orbit QA Adventure",
      );
      assert.deepEqual(tagged.tags, ["Cooperativo", "Con amigos"]);
      await page
        .getByRole("combobox", { name: "Filtrar por etiqueta" })
        .selectOption("cooperativo");
      await page
        .getByRole("button", {
          name: "Seleccionar Orbit QA Adventure",
          exact: true,
        })
        .waitFor();
      await assert.rejects(
        page.evaluate(
          (id) =>
            window.orbit.updateGame(id, {
              tags: ["x".repeat(41)],
              notes: "Invalid tag changed notes",
            }),
          tagged.id,
        ),
      );
      assert.deepEqual(
        (await page.evaluate(() => window.orbit.getLibrary())).games.find(
          (g) => g.id === tagged.id,
        ).tags,
        tagged.tags,
      );
      await page.evaluate(
        (id) => window.orbit.updateGame(id, { tags: [] }),
        tagged.id,
      );
      await page
        .getByRole("button", {
          name: "Seleccionar Orbit QA Adventure",
          exact: true,
        })
        .waitFor({ state: "hidden" });
      await page.evaluate(
        ({ id, tags }) => window.orbit.updateGame(id, { tags }),
        tagged,
      );
      await page
        .getByRole("button", {
          name: "Seleccionar Orbit QA Adventure",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("combobox", { name: "Filtrar por etiqueta" })
        .selectOption("");
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page
      .getByRole("button", {
        name: "Seleccionar Orbit QA Adventure",
        exact: true,
      })
      .scrollIntoViewIfNeeded();
    const progressGame = discovered.games.find(
      (game) => game.name === "Orbit QA Adventure",
    );
    await assert.rejects(
      page.evaluate(
        (id) =>
          window.orbit.updateGame(id, {
            playStatus: "invalid",
            notes: "Must not save",
          }),
        progressGame.id,
      ),
    );
    const afterInvalid = await page.evaluate(() => window.orbit.getLibrary());
    assert.equal(
      afterInvalid.games.find((game) => game.id === progressGame.id).playStatus,
      "playing",
    );
    assert.notEqual(
      afterInvalid.games.find((game) => game.id === progressGame.id).notes,
      "Must not save",
    );
    await page.screenshot({
      path: path.join(output, "next-progress.png"),
      animations: "disabled",
    });
    await page
      .getByRole("combobox", { name: "Filtrar por progreso" })
      .selectOption("all");
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Conectar GOG", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Conectar Epic Games", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Conectar Steam", exact: true })
      .waitFor();
    assert.equal(
      (await page.evaluate(() => window.orbit.getLibrary())).accounts.length,
      0,
    );
    const unsupported = await page.evaluate(() =>
      window.orbit.connectAccount("unsupported-provider"),
    );
    assert.equal(unsupported.error.code, "unsupported");
    await page.screenshot({
      path: path.join(output, "next-accounts.png"),
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Revisar carpetas y juegos", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Tus juegos empiezan aquí" })
      .waitFor();
    assert.ok(await page.getByText(fixture, { exact: true }).count());
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.waitForSelector(".game-grid");
    assert.deepEqual(errors, []);
    assert.deepEqual(
      remoteRequests,
      [],
      "Online features must stay off until explicitly enabled",
    );
    await fs.writeFile(
      path.join(output, "next-qa-results.json"),
      JSON.stringify(
        {
          success: true,
          isolatedProfile: true,
          artworkPersistedAfterRestart: true,
          offlineRespected: true,
          rendererErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        success: true,
        isolatedProfile: true,
        confirmedExecutablePersisted: true,
        setupPersistedAfterRestart: true,
        reopenedSetup: true,
        narrowLayout: true,
        artworkPersistedAfterRestart: true,
        offlineRespected: true,
        rendererErrors: errors,
      }),
    );
  } finally {
    if (application) await application.close();
  }
  // QA artifacts intentionally stay within the Next profile for diagnosis.
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
