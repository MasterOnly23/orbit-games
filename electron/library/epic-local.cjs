const path = require("node:path");
const { game } = require("./detected-game.cjs");

async function scanEpic({
  programData = process.env.ProgramData || "C:\\ProgramData",
  io,
}) {
  const { read, exists, entries } = io;
  const games = [],
    warnings = [],
    watchPaths = [],
    epicGames = new Map();
  const epicDir = path.join(
    programData,
    "Epic",
    "EpicGamesLauncher",
    "Data",
    "Manifests",
  );
  watchPaths.push(epicDir);
  for (const f of await entries(epicDir)) {
    if (!f.name.endsWith(".item")) continue;
    try {
      const m = JSON.parse(await read(path.join(epicDir, f.name)));
      if (!m.bIsApplication || !m.DisplayName || !m.LaunchExecutable) continue;
      const installed =
        !m.bIsIncompleteInstall &&
        (await exists(path.join(m.InstallLocation, m.LaunchExecutable)));
      const providerId = [m.CatalogNamespace, m.CatalogItemId, m.AppName].join(
        ":",
      );
      const g = game(m.DisplayName, "Epic Games", `epic:${m.AppName}`, {
        providerId,
        status: installed ? "installed" : "uninstalled",
        statusReason: installed
          ? "Manifiesto de Epic y ejecutable presentes."
          : "Epic no tiene una instalación completa accesible.",
        installPath: m.InstallLocation,
        sizeBytes: m.InstallSize || 0,
        launch: {
          kind: "uri",
          target: `com.epicgames.launcher://apps/${encodeURIComponent(providerId)}?action=launch&silent=true`,
        },
        sources: [path.join(epicDir, f.name)],
      });
      epicGames.set(m.AppName.toLowerCase(), g);
      games.push(g);
    } catch {
      warnings.push(`No se pudo leer el manifiesto de Epic: ${f.name}`);
    }
  }

  return {
    games,
    warnings,
    watchPaths,
    byAppName: epicGames,
    manifestDirectory: epicDir,
  };
}
module.exports = { scanEpic };
