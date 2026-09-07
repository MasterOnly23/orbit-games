const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ORBIT_DATA_DIR;
  delete env.ORBIT_SKIP_SCAN;
  const executable = path.join(
    process.env.LOCALAPPDATA,
    "Programs",
    "Orbit Games",
    "Orbit Games.exe",
  );
  const application = await electron.launch({
    executablePath: executable,
    args: [],
    env,
  });
  try {
    const page = await application.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForSelector(".game-grid", { timeout: 60000 });
    await page.waitForFunction(
      () => !document.querySelector(".scan-button")?.disabled,
      { timeout: 60000 },
    );
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("Cyberpunk");
    await page
      .getByRole("button", { name: "Seleccionar Cyberpunk 2077", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".hero-description")
          ?.textContent.includes("Cyberpunk"),
      { timeout: 20000 },
    );
    await page
      .getByRole("textbox", { name: "Buscar un juego", exact: true })
      .fill("");
    await page.waitForFunction(
      () => document.querySelector(".hero-art img")?.naturalWidth > 0,
    );
    console.log(
      "Installed application loaded. Waiting for initial artwork enrichment.",
    );
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const count = await page.evaluate(() =>
        window.orbit
          .getLibrary()
          .then((s) => s.games.filter((g) => g.metadata).length),
      );
      if (count >= 24) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await page.screenshot({
      path: "output/playwright/orbit-games-final.png",
      animations: "disabled",
    });
    const library = await page.evaluate(() => window.orbit.getLibrary());
    const report = {
      installedExecutable: executable,
      total: library.games.length,
      statuses: library.games.reduce(
        (a, g) => ((a[g.status] = (a[g.status] || 0) + 1), a),
        {},
      ),
      metadata: library.games.filter((g) => g.metadata).length,
      startWithWindows: library.settings.startWithWindows,
      warnings: library.warnings,
      rendererErrors: errors,
    };
    await fs.writeFile(
      "output/playwright/installed-verification.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await application.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
