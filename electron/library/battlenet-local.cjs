const path = require("node:path");
const { game } = require("./detected-game.cjs");
const { executableFromIcon } = require("./model.cjs");
const { fileAvailability } = require("./availability.cjs");
const { abortable } = require("./abortable.cjs");
const { battleNetTitleId } = require("./battlenet-identity.cjs");

// Installation records only. No Battle.net sessions or account database reads.
async function scanBattleNet({
  inventory,
  availability = fileAvailability,
  signal,
}) {
  const games = [],
    watchPaths = [],
    warnings = [],
    seen = new Set();
  for (const entry of inventory.uninstall || []) {
    signal?.throwIfAborted();
    if (
      !/Blizzard/i.test(entry.Publisher || "") ||
      !entry.DisplayName ||
      !entry.PSChildName ||
      /battle\.?net|launcher|agent|updat(e|er)|redistributable/i.test(
        entry.DisplayName,
      )
    )
      continue;
    const directory = entry.InstallLocation,
      executable = executableFromIcon(entry.DisplayIcon);
    if (
      typeof directory !== "string" ||
      !path.isAbsolute(directory) ||
      !path.isAbsolute(executable)
    )
      continue;
    const relative = path.relative(directory, executable);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative) ||
      !/\.exe$/i.test(executable) ||
      /battle\.?net|launcher|agent|unins|setup|updater/i.test(
        path.basename(executable),
      )
    )
      continue;
    const key = String(entry.PSChildName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const state = await abortable(() => availability(executable), signal);
    signal?.throwIfAborted();
    games.push(
      game(entry.DisplayName, "Battle.net", `battlenet:registry:${key}`, {
        ...state,
        providerId: battleNetTitleId(entry),
        installPath: directory,
        targetExecutable: executable,
        launch: { kind: "file", target: executable },
        sources: [`registry:${entry.PSChildName}`],
      }),
    );
    watchPaths.push(directory);
  }
  return { games, watchPaths: [...new Set(watchPaths)], warnings };
}
module.exports = { scanBattleNet };
