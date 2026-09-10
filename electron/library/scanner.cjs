const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const { scanRiot } = require("./riot.cjs");
const { scanItch } = require("./itch-local.cjs");
const { abortable } = require("./abortable.cjs");
const {
  normalize,
  idFor,
  parseVdf,
  classifyUri,
  validLaunchUri,
  executableFromIcon,
  registryIdentity,
} = require("./model.cjs");
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
function game(name, provider, identity, props) {
  return {
    id: idFor(identity),
    name,
    provider,
    status: "unknown",
    statusReason: "No se pudo comprobar la instalación.",
    sources: [],
    ...props,
  };
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
  const steamGames = new Map(),
    epicGames = new Map();
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
  const steamRoot = inventory.steamPath || "C:\\Program Files (x86)\\Steam";
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
      if (inventory.steamPath || library !== steamRoot)
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
  const epicDir = path.join(
    process.env.ProgramData || "C:\\ProgramData",
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
  const packages = inventory.packages || [];
  for (const shortcut of inventory.shortcuts) {
    if (!shortcut.target && !shortcut.parsing?.includes("!")) {
      const start = inventory.startApps.find(
        (a) =>
          normalize(a.Name) === normalize(shortcut.name) &&
          a.AppID?.includes("!"),
      );
      if (
        start &&
        packages.some((p) => start.AppID.startsWith(`${p.PackageFamilyName}!`))
      )
        shortcut.parsing = start.AppID;
    }
    if (shortcut.target && !/\.exe$/i.test(shortcut.target)) continue;
    if (/^https?:/i.test(shortcut.parsing || shortcut.url)) continue;
    const uri = shortcut.url;
    const identity = classifyUri(uri);
    let g;
    if (identity) {
      const steam = identity.steamId && steamGames.get(identity.steamId);
      const appName =
        identity.provider === "Epic Games"
          ? decodeURIComponent(uri.split("/apps/")[1]?.split("?")[0] || "")
              .split(":")
              .at(-1)
              .toLowerCase()
          : null;
      const epic = appName && epicGames.get(appName);
      if (steam || epic) {
        (steam || epic).sources.push(shortcut.path);
        continue;
      }
      let status = "unknown",
        reason = "El acceso abre el lanzador; este no confirma la instalación.";
      if (identity.provider === "Steam" && !missingSteamLibraries.length) {
        status = "uninstalled";
        reason =
          "No hay un manifiesto de instalación en las bibliotecas de Steam.";
      }
      if (identity.provider === "Epic Games" && (await exists(epicDir))) {
        status = "uninstalled";
        reason = "No hay un manifiesto de instalación de Epic para este juego.";
      }
      if (identity.provider === "Ubisoft") {
        const install = inventory.ubisoft.find(
          (i) => i.id === identity.providerId,
        );
        if (install && (await exists(install.path))) {
          status = "installed";
          reason =
            "Ubisoft registra la instalación y la carpeta está disponible.";
        }
      }
      g = game(
        shortcut.name,
        identity.provider,
        identity.steamId ? `steam:${identity.steamId}` : uri,
        {
          ...identity,
          status,
          statusReason: reason,
          launch: { kind: "uri", target: uri },
          sources: [shortcut.path],
        },
      );
    } else if (shortcut.parsing?.includes("!") && !shortcut.target) {
      const aumid = shortcut.parsing.replace(/^shell:AppsFolder\\/i, "");
      const p = packages.find(
        (p) => p.PackageFamilyName === aumid.split("!")[0],
      );
      g = game(shortcut.name, "Xbox", aumid, {
        status: p
          ? "installed"
          : inventory.packageScanOk
            ? "uninstalled"
            : "unknown",
        statusReason: p
          ? "Aplicación registrada para tu usuario de Windows."
          : inventory.packageScanOk
            ? "El paquete de este juego no está instalado para tu usuario."
            : "No se pudieron consultar los paquetes de Windows.",
        installPath: p?.InstallLocation,
        launch: { kind: "app", target: aumid },
        sources: [shortcut.path],
      });
    } else {
      const target = shortcut.target;
      const reg = inventory.uninstall.find(
        (r) =>
          (r.InstallLocation &&
            target
              ?.toLowerCase()
              .startsWith(r.InstallLocation.toLowerCase())) ||
          normalize(r.DisplayName) === normalize(shortcut.name),
      );
      const provider = reg?.Publisher?.match(/Electronic Arts/i)
        ? "EA app"
        : /RiotClient/i.test(target)
          ? "Riot Games"
          : /Diablo|Battle\.net|Blizzard/i.test(target)
            ? "Battle.net"
            : /Rockstar/i.test(target)
              ? "Rockstar"
              : /EA Games|Origin Games/i.test(target)
                ? "EA app"
                : "Otros";
      const present = await exists(target);
      const sharedLauncher = /RiotClient|LauncherPatcher|maintenancetool/i.test(
        target,
      );
      g = game(shortcut.name, provider, shortcut.path, {
        status: present
          ? sharedLauncher
            ? "unknown"
            : "installed"
          : "uninstalled",
        statusReason: present
          ? sharedLauncher
            ? "El lanzador existe; la instalación del juego necesita confirmación."
            : "El ejecutable del acceso directo está disponible."
          : "El destino del acceso directo ya no existe.",
        installPath: target ? path.dirname(target) : null,
        launch: { kind: "file", target: shortcut.path },
        targetExecutable: target,
        sources: [shortcut.path],
      });
      if (!target && !shortcut.parsing) {
        g.status = "unknown";
        g.statusReason =
          "Windows no proporcionó el destino de este acceso directo.";
      }
      if (provider === "Riot Games" && shortcut.arguments) {
        const product = shortcut.arguments.match(
          /--launch-product=([\w_]+)/,
        )?.[1];
        const channel = shortcut.arguments.match(
          /--launch-patchline=([\w_]+)/,
        )?.[1];
        if (product && channel) {
          const installation = riot.games.find(
            (game) => game.providerId === `${product}:${channel}`,
          );
          if (installation) {
            g.providerId = installation.providerId;
            g.status = installation.status;
            g.statusReason = installation.statusReason;
            g.installPath = installation.installPath;
            g.targetExecutable = installation.targetExecutable;
          }
        }
      }
      if (/^https?:/i.test(shortcut.parsing || uri)) {
        g.status = "unknown";
        g.statusReason = "Este acceso abre una página web.";
      }
    }
    games.push(g);
  }
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
      games.some(
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
      if (games.some((g) => g.launch?.target === start.AppID)) continue;
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
      games.some(
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
