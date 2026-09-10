const path = require("node:path");
const { parseVdf } = require("./model.cjs");
const { game } = require("./detected-game.cjs");

async function scanSteam({ steamPath, io }) {
  const { read, exists, entries } = io;
  const games = [],
    warnings = [],
    watchPaths = [],
    steamGames = new Map();
  const steamRoot = steamPath || "C:\\Program Files (x86)\\Steam";
  const libraries =
    parseVdf(
      await read(path.join(steamRoot, "steamapps", "libraryfolders.vdf")),
    ).libraryfolders || {};
  const steamPaths = [
    ...new Set([
      steamRoot,
      ...Object.values(libraries)
        .map((v) => (typeof v === "string" ? v : v.path))
        .filter(Boolean),
    ]),
  ];
  const missingSteamLibraries = [];
  for (const library of steamPaths) {
    const dir = path.join(library, "steamapps");
    watchPaths.push(dir);
    if (!(await exists(dir))) {
      if (steamPath || library !== steamRoot)
        missingSteamLibraries.push(library);
      continue;
    }
    for (const file of await entries(dir)) {
      if (!/^appmanifest_\d+\.acf$/.test(file.name)) continue;
      const m = parseVdf(await read(path.join(dir, file.name))).AppState;
      if (
        !m?.appid ||
        !m.name ||
        /Steamworks Common Redistributables|Steam Linux Runtime|Proton/i.test(
          m.name,
        )
      )
        continue;
      const installPath = path.join(dir, "common", m.installdir || "");
      const present = await exists(installPath);
      const installed = present && (Number(m.StateFlags) & 4) !== 0;
      const g = game(m.name, "Steam", `steam:${m.appid}`, {
        steamId: m.appid,
        providerId: m.appid,
        status: installed ? "installed" : present ? "unknown" : "uninstalled",
        statusReason: installed
          ? "Steam confirma la instalación y la carpeta existe."
          : present
            ? "Steam está descargando, actualizando o verificando el juego."
            : "No se encuentra la carpeta de instalación.",
        installPath,
        sizeBytes: Number(m.SizeOnDisk) || 0,
        launch: { kind: "uri", target: `steam://rungameid/${m.appid}` },
        sources: [path.join(dir, file.name)],
      });
      steamGames.set(m.appid, g);
      games.push(g);
    }
  }
  if (missingSteamLibraries.length)
    warnings.push(
      "Hay bibliotecas de Steam no accesibles; sus juegos pueden quedar sin verificar.",
    );

  return { games, warnings, watchPaths, byAppId: steamGames };
}
module.exports = { scanSteam };
