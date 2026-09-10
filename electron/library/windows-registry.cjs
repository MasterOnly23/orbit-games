const path = require("node:path");
const { game } = require("./detected-game.cjs");
const {
  normalize,
  executableFromIcon,
  registryIdentity,
} = require("./model.cjs");
async function scanRegistry({ inventory, knownGames, io }) {
  const { exists } = io;
  const games = [];
  // Additional EA/GOG/Ubisoft games which have no shortcut in Games.
  for (const r of inventory.uninstall) {
    if (
      !r.InstallLocation ||
      /launcher|connect|EA app|EA Desktop|anti.?cheat|redistributable/i.test(
        r.DisplayName,
      )
    )
      continue;
    const provider = /Electronic Arts/i.test(r.Publisher)
      ? "EA app"
      : /Ubisoft/i.test(r.Publisher)
        ? "Ubisoft"
        : /GOG.com/i.test(r.Publisher)
          ? "GOG"
          : null;
    if (
      !provider ||
      knownGames
        .concat(games)
        .some(
          (g) =>
            g.provider === provider &&
            normalize(g.name) === normalize(r.DisplayName),
        )
    )
      continue;
    const executable = executableFromIcon(r.DisplayIcon);
    if (
      !/\.exe$/i.test(executable) ||
      /unins|setup/i.test(path.basename(executable))
    )
      continue;
    const present = await exists(executable);
    games.push(
      game(r.DisplayName, provider, `registry:${r.PSChildName}`, {
        ...registryIdentity(provider, r.PSChildName),
        status: present ? "installed" : "uninstalled",
        statusReason: present
          ? "Registro de Windows y ejecutable disponibles."
          : "El registro existe, pero falta el ejecutable.",
        installPath: r.InstallLocation,
        launch: { kind: "file", target: executable },
        targetExecutable: executable,
        sources: [`registry:${r.PSChildName}`],
      }),
    );
  }
  return { games };
}
module.exports = { scanRegistry };
