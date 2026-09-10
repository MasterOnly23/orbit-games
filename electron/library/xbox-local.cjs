const path = require("node:path");
const { game } = require("./detected-game.cjs");
async function scanXbox({ inventory, knownGames, io }) {
  const { exists, read, entries } = io;
  const games = [],
    watchPaths = [];
  const packages = inventory.packages || [];
  // Xbox PC installs put MicrosoftGame.config in Content. Read only these bounded folders.
  for (const drive of inventory.drives) {
    const root = path.join(drive, "XboxGames");
    if (!(await exists(root))) continue;
    watchPaths.push(root);
    for (const folder of await entries(root)) {
      if (!folder.isDirectory()) continue;
      const config = await read(
        path.join(root, folder.name, "Content", "MicrosoftGame.config"),
      );
      if (!config) continue;
      const identityName = config.match(
        /<Identity\b[^>]*\bName="([^"]+)"/i,
      )?.[1];
      const p = packages.find((p) => p.Name === identityName);
      if (!p) continue;
      const start = inventory.startApps.find((a) =>
        a.AppID?.startsWith(`${p.PackageFamilyName}!`),
      );
      if (!start) continue;
      if (
        knownGames.concat(games).some((g) => g.launch?.target === start.AppID)
      )
        continue;
      games.push(
        game(start.Name, "Xbox", start.AppID, {
          status: "installed",
          statusReason: "Instalación Xbox y aplicación de Windows registradas.",
          installPath: path.join(root, folder.name, "Content"),
          launch: { kind: "app", target: start.AppID },
          sources: [
            path.join(root, folder.name, "Content", "MicrosoftGame.config"),
          ],
        }),
      );
    }
  }
  // Gaming packages installed outside XboxGames; use a game-specific manifest, never all Store apps.
  for (const p of packages) {
    if (
      knownGames
        .concat(games)
        .some(
          (g) =>
            g.launch?.kind === "app" &&
            g.launch.target.startsWith(`${p.PackageFamilyName}!`),
        )
    )
      continue;
    if (
      !(await exists(
        path.join(p.InstallLocation || "", "MicrosoftGame.config"),
      ))
    )
      continue;
    const start = inventory.startApps.find((a) =>
      a.AppID?.startsWith(`${p.PackageFamilyName}!`),
    );
    if (!start) continue;
    games.push(
      game(start.Name, "Xbox", start.AppID, {
        status: "installed",
        statusReason: "Paquete de juego de Windows instalado.",
        installPath: p.InstallLocation,
        launch: { kind: "app", target: start.AppID },
        sources: [path.join(p.InstallLocation, "MicrosoftGame.config")],
      }),
    );
  }
  return { games, watchPaths };
}
module.exports = { scanXbox };
