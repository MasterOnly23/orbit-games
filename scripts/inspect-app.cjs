const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({ args: ["."], env });
  const page = await application.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForSelector(".game-grid", { timeout: 90000 });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => window.orbit.getLibrary());
  await fs.mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/library-first.png" });
  console.log(
    JSON.stringify(
      {
        games: state.games.length,
        installed: state.games.filter((g) => g.status === "installed").length,
        metadata: state.games.filter((g) => g.metadata).length,
        errors,
      },
      null,
      2,
    ),
  );
  await application.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
