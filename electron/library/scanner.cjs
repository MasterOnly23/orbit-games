const { scanShortcuts } = require("./windows-shortcuts.cjs");
const { scanRegistry } = require("./windows-registry.cjs");
const { scanXbox } = require("./xbox-local.cjs");
const { scanSteam } = require("./steam-local.cjs");
const { scanEpic } = require("./epic-local.cjs");
const { game } = require("./detected-game.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const { scanRiot } = require("./riot.cjs");
const { scanItch } = require("./itch-local.cjs");
const { abortable } = require("./abortable.cjs");
const { classifyUri, validLaunchUri } = require("./model.cjs");
async function exists(file) {
  if (!file) return false;
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function read(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}
async function entries(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
async function windowsInventory(folders, script, { signal } = {}) {
  signal?.throwIfAborted();
  const powershell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const { stdout } = await run(
    powershell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
    ],
    {
      windowsHide: true,
      signal,
      timeout: 90000,
      maxBuffer: 12 * 1024 * 1024,
      env: {
        ...process.env,
        ORBIT_SCAN_FOLDERS: JSON.stringify(
          folders.map((folder) => path.normalize(folder)),
        ),
      },
    },
  );
  return JSON.parse(stdout.replace(/^\uFEFF/, ""));
}
const scanIo = { read, exists, entries };
async function scanLibrary(folders, script, { signal, gameFolders = [] } = {}) {
  const read = (file) => abortable(() => scanIo.read(file), signal);
  const exists = (file) => abortable(() => scanIo.exists(file), signal);
  const entries = (dir) => abortable(() => scanIo.entries(dir), signal);
  const inventory = await windowsInventory(folders, script, { signal });
  const games = [],
    watchPaths = [...folders],
    warnings = [...inventory.warnings];
  const riot = await abortable(() => scanRiot(), signal);
  games.push(...riot.games);
  warnings.push(...riot.warnings);
  watchPaths.push(...riot.watchPaths);
  const itch = await scanItch({
    roots: [
      path.join(process.env.APPDATA || "", "itch", "apps"),
      ...gameFolders,
    ],
    signal,
  });
  games.push(...itch.games);
  warnings.push(...itch.warnings);
  watchPaths.push(...itch.watchPaths);
  const io = { read, exists, entries };
  const steam = await scanSteam({ steamPath: inventory.steamPath, io });
  const epic = await scanEpic({ io });
  for (const result of [steam, epic]) {
    games.push(...result.games);
    warnings.push(...result.warnings);
    watchPaths.push(...result.watchPaths);
  }
  const shortcuts = await scanShortcuts({ inventory, steam, epic, riot, io });
  games.push(...shortcuts.games);
  warnings.push(...shortcuts.warnings);
  const registry = await scanRegistry({ inventory, knownGames: games, io });
  games.push(...registry.games);
  const xbox = await scanXbox({ inventory, knownGames: games, io });
  games.push(...xbox.games);
  watchPaths.push(...xbox.watchPaths);
  for (const folder of folders) {
    for (const entry of await entries(folder)) {
      if (entry.isDirectory() && !entry.isSymbolicLink())
        watchPaths.push(path.join(folder, entry.name));
    }
  }
  return {
    games,
    watchPaths: [...new Set(watchPaths)],
    warnings,
    scannedAt: new Date().toISOString(),
  };
}
async function inspectManual(target, name, inventoryScript) {
  if (validLaunchUri(target))
    return game(
      name || "Nuevo juego",
      classifyUri(target).provider,
      `manual:${target}`,
      {
        ...classifyUri(target),
        manual: true,
        launch: { kind: "uri", target },
        statusReason:
          "Agregado a mano. Selecciona el estado o vuelve a detectar.",
        sources: [],
      },
    );
  if (
    !path.isAbsolute(target) ||
    ![".exe", ".lnk", ".url"].includes(path.extname(target).toLowerCase())
  )
    throw new Error(
      "Elige un archivo .exe, .lnk o .url, o un enlace de un lanzador compatible.",
    );
  if (!(await exists(target)))
    throw new Error("No se encuentra el archivo seleccionado.");
  if (/\.url$/i.test(target)) {
    const uri = (await read(target)).match(/^URL=(.+)$/im)?.[1]?.trim();
    if (!validLaunchUri(uri))
      throw new Error("Este acceso no contiene un enlace de juego compatible.");
    return {
      ...(await inspectManual(
        uri,
        name || path.basename(target, ".url"),
        inventoryScript,
      )),
      sources: [target],
    };
  }
  let actual = target;
  if (/\.lnk$/i.test(target)) {
    const inventory = await windowsInventory(
      [path.dirname(target)],
      inventoryScript,
    );
    const shortcut = inventory.shortcuts.find(
      (s) => s.path.toLowerCase() === target.toLowerCase(),
    );
    if (shortcut?.parsing?.includes("!") && !shortcut.target) {
      const p = inventory.packages.find(
        (p) => p.PackageFamilyName === shortcut.parsing.split("!")[0],
      );
      return game(name || shortcut.name, "Xbox", `manual:${target}`, {
        manual: true,
        status: p ? "installed" : "uninstalled",
        statusReason: p
          ? "Paquete de Windows instalado."
          : "El paquete no está instalado.",
        launch: { kind: "app", target: shortcut.parsing },
        sources: [target],
      });
    }
    actual = shortcut?.target || "";
  }
  return game(
    name || path.basename(target, path.extname(target)),
    "Otros",
    `manual:${target}`,
    {
      manual: true,
      status: (await exists(actual)) ? "installed" : "unknown",
      statusReason: (await exists(actual))
        ? "El ejecutable está disponible."
        : "No se pudo comprobar el destino del acceso.",
      targetExecutable: actual,
      installPath: actual ? path.dirname(actual) : null,
      launch: { kind: "file", target },
      sources: [target],
    },
  );
}
module.exports = { scanLibrary, windowsInventory, exists, read, inspectManual };
