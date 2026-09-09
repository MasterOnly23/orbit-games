const { app, dialog, shell, nativeImage } = require("electron");
const path = require("node:path");
const fsp = require("node:fs/promises");
const { inspectManual, exists } = require("./library/scanner.cjs");
const {
  matchMetadata,
  searchMetadata,
  getMetadata,
} = require("./library/metadata.cjs");
const { launchGame } = require("./platform/launch.cjs");
const { validateLaunchOptions } = require("./platform/launch-options.cjs");
const { idFor } = require("./library/model.cjs");
const { createHash } = require("node:crypto");
const playStatuses = require("./library/play-status.json");
const { createDiagnostics } = require("./library/diagnostics.cjs");
const os = require("node:os");
function playStatus(value = "none") {
  if (typeof value !== "string" || !Object.hasOwn(playStatuses, value))
    throw new Error("Selecciona un estado de progreso válido.");
  return value;
}
const {
  createBackup,
  writeBackup,
  readBackup,
  restoreBackup,
} = require("./library/backup.cjs");
function registerIpc({
  win,
  store,
  handle,
  snapshot,
  scan,
  save,
  enrich,
  report,
  setWatchers,
  loginOptions,
  inventoryScript,
}) {
  handle("library:get", () => snapshot());
  handle("diagnostics:export", async () => {
    const result = await dialog.showSaveDialog(win, {
      title: "Guardar diagnóstico de Orbit Next",
      defaultPath: "Orbit Next - diagnostico.json",
      filters: [{ name: "Diagnóstico JSON", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    const diagnostic = createDiagnostics(store.data, {
      version: app.getVersion(),
      electron: process.versions.electron,
      packaged: app.isPackaged,
      platform: process.platform,
      architecture: process.arch,
      release: os.release(),
    });
    await fsp.writeFile(
      result.filePath,
      JSON.stringify(diagnostic, null, 2),
      "utf8",
    );
    return true;
  });
  handle("library:scan", scan);
  handle("game:update", async (id, patch) => {
    const g = store.getGame(id);
    const changes = {};
    if (!patch || typeof patch !== "object")
      throw new Error("Cambios no válidos.");
    if (patch.playStatus !== undefined)
      changes.playStatus = playStatus(patch.playStatus);
    for (const key of ["favorite", "hidden"])
      if (typeof patch[key] === "boolean") changes[key] = patch[key];
    for (const key of ["notes", "customName"])
      if (typeof patch[key] === "string")
        changes[key] = patch[key].slice(0, key === "notes" ? 5000 : 200);
    if (
      ["auto", "installed", "uninstalled", "unknown"].includes(
        patch.statusOverride,
      )
    )
      changes.statusOverride = patch.statusOverride;
    if (typeof patch.target === "string" && patch.target) {
      const replacement = await inspectManual(
        patch.target,
        changes.customName || g.customName || g.name,
        inventoryScript,
      );
      Object.assign(changes, {
        launch: replacement.launch,
        targetExecutable: replacement.targetExecutable,
        installPath: replacement.installPath,
        status: replacement.status,
        statusReason: replacement.statusReason,
        manual: true,
      });
    }
    if (patch.launchOptions !== undefined) {
      changes.launchOptions = await validateLaunchOptions(
        changes.launch || g.launch,
        patch.launchOptions,
      );
      if (
        changes.launchOptions.args.length ||
        changes.launchOptions.workingDirectory
      )
        changes.manual = true;
    }
    Object.assign(g, changes);
    await save();
    return snapshot();
  });
  handle("game:add", async (payload) => {
    const progress = playStatus(payload?.playStatus);
    if (typeof payload?.target !== "string" || payload.target.length > 2048)
      throw new Error("Selecciona una ruta válida.");
    const g = await inspectManual(
      payload.target.trim(),
      String(payload.name || "")
        .trim()
        .slice(0, 200),
      inventoryScript,
    );
    g.launchOptions = await validateLaunchOptions(
      g.launch,
      payload.launchOptions || { args: [], workingDirectory: "" },
    );
    if (g.launchOptions.args.length || g.launchOptions.workingDirectory)
      g.id = idFor(
        `manual:${g.launch.target}:${createHash("sha256").update(JSON.stringify(g.launchOptions)).digest("hex")}`,
      );
    const existing = store.data.games.find(
      (old) =>
        old.launch?.target.toLowerCase() === g.launch.target.toLowerCase() &&
        JSON.stringify(
          old.launchOptions || { args: [], workingDirectory: "" },
        ) === JSON.stringify(g.launchOptions),
    );
    if (existing) {
      existing.hidden = false;
      await save();
      return existing.id;
    }
    store.data.games.push({
      ...g,
      playStatus: progress,
      addedAt: new Date().toISOString(),
      favorite: false,
      hidden: false,
      notes: "",
      statusOverride: "auto",
    });
    await save();
    enrich().catch(report);
    return g.id;
  });
  handle("game:launch", async (id) => {
    const g = store.getGame(id);
    await launchGame(g, shell);
    g.lastPlayed = new Date().toISOString();
    g.launchCount = (g.launchCount || 0) + 1;
    await save();
    if (store.data.settings.minimizeOnLaunch) win.minimize();
    return { name: g.customName || g.name };
  });
  handle("game:launcher", async (id) => {
    const g = store.getGame(id);
    const uris = {
      Steam: `steam://nav/games/details/${g.steamId || ""}`,
      "EA app": "origin2://library",
      Xbox: "ms-xbox://",
      "Epic Games": "com.epicgames.launcher://library",
      Ubisoft: "uplay://",
      "Battle.net": "battlenet://",
      "Humble Bundle": "https://www.humblebundle.com/home/library",
      GOG: "https://www.gog.com/account/",
      "itch.io": "https://itch.io/my-purchases",
    };
    const uri = uris[g.provider];
    if (!uri)
      throw new Error(
        "Abre su lanzador habitual o agrega el ejecutable desde Editar.",
      );
    await shell.openExternal(uri);
  });
  handle("game:reveal", async (id) => {
    const g = store.getGame(id);
    if (g.installPath && (await exists(g.installPath))) {
      const error = await shell.openPath(g.installPath);
      if (error) throw new Error(error);
    } else if (g.sources?.[0] && (await exists(g.sources[0])))
      shell.showItemInFolder(g.sources[0]);
    else throw new Error("No se encuentra la carpeta ni el acceso.");
  });
  handle("dialog:file", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Selecciona un juego o su acceso directo",
      properties: ["openFile"],
      filters: [
        {
          name: "Juegos y accesos directos",
          extensions: ["exe", "lnk", "url"],
        },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("dialog:folder", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Carpeta de accesos directos",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("settings:update", async (patch) => {
    if (!patch || typeof patch !== "object")
      throw new Error("Ajustes no válidos.");
    const settings = store.data.settings;
    for (const key of [
      "autoScan",
      "onlineMetadata",
      "closeToTray",
      "minimizeOnLaunch",
    ])
      if (typeof patch[key] === "boolean") settings[key] = patch[key];
    if (patch.folders) {
      if (
        !Array.isArray(patch.folders) ||
        patch.folders.length > 20 ||
        patch.folders.some((p) => typeof p !== "string" || !path.isAbsolute(p))
      )
        throw new Error("Las carpetas deben tener rutas absolutas.");
      settings.folders = [...new Set(patch.folders)];
    }
    if (typeof patch.startWithWindows === "boolean") {
      app.setLoginItemSettings({
        ...loginOptions(),
        openAtLogin: patch.startWithWindows,
      });
    }
    await save();
    if (!settings.autoScan) setWatchers([]);
    else if (patch.autoScan === true || patch.folders) scan().catch(report);
    if (patch.onlineMetadata === true) enrich().catch(report);
    return snapshot();
  });
  handle("metadata:search", async (query) => {
    if (!store.data.settings.onlineMetadata)
      throw new Error("Activa las fichas en línea en Ajustes.");
    if (typeof query !== "string" || query.length < 2 || query.length > 200)
      throw new Error("Escribe el nombre del juego.");
    return searchMetadata(query);
  });
  handle("metadata:apply", async (id, steamId) => {
    if (!store.data.settings.onlineMetadata)
      throw new Error("Activa las fichas en línea.");
    const meta = await getMetadata(String(steamId));
    store.getGame(id).metadata = meta;
    await save();
    return snapshot();
  });
  handle("metadata:refresh", async (id) => {
    if (!store.data.settings.onlineMetadata)
      throw new Error("Activa las fichas en línea.");
    const g = store.getGame(id),
      meta = await matchMetadata(g);
    if (!meta)
      throw new Error(
        "No hay una coincidencia exacta. Busca la ficha y selecciónala.",
      );
    store.getGame(id).metadata = meta;
    await save();
    return snapshot();
  });
  handle("metadata:source", (id) => {
    const idValue = store.getGame(id).metadata?.steamId;
    if (!/^\d+$/.test(idValue || ""))
      throw new Error("Este juego no tiene una ficha asociada.");
    return shell.openExternal(`https://store.steampowered.com/app/${idValue}/`);
  });
  handle("artwork:choose", async (id) => {
    const g = store.getGame(id);
    const result = await dialog.showOpenDialog(win, {
      title: "Selecciona una imagen para el juego",
      properties: ["openFile"],
      filters: [
        { name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] },
      ],
    });
    if (result.canceled) return false;
    const stat = await fsp.stat(result.filePaths[0]);
    if (stat.size > 20 * 1024 * 1024)
      throw new Error("La imagen debe pesar menos de 20 MB.");
    let image = nativeImage.createFromPath(result.filePaths[0]);
    if (image.isEmpty())
      throw new Error("No se pudo leer esta imagen. Prueba con un JPG o PNG.");
    if (image.getSize().width > 1920) image = image.resize({ width: 1920 });
    await fsp.mkdir(path.join(store.directory, "artwork"), { recursive: true });
    await fsp.writeFile(
      path.join(store.directory, "artwork", `${g.id}.jpg`),
      image.toJPEG(88),
    );
    delete g.artworkFile;
    g.artworkRevision = Date.now();
    await save();
    return true;
  });
  handle("artwork:clear", async (id) => {
    const g = store.getGame(id);
    g.artworkRevision = null;
    await save();
    return true;
  });
  handle("library:export", async () => {
    const result = await dialog.showSaveDialog(win, {
      title: "Guardar biblioteca y portadas",
      defaultPath: "Orbit Next - biblioteca.json",
      filters: [{ name: "Respaldo de Orbit", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    await writeBackup(result.filePath, await createBackup(store));
    return true;
  });
  handle("library:import", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Restaurar biblioteca y portadas",
      properties: ["openFile"],
      filters: [{ name: "Respaldo de Orbit", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    const backup = await readBackup(result.filePaths[0], (bytes) => {
      const image = nativeImage.createFromBuffer(bytes);
      const size = image.getSize();
      return !image.isEmpty() && size.width <= 20000 && size.height <= 20000;
    });
    const existing = new Set(store.data.games.map((g) => g.id));
    const additions = backup.games.filter((g) => !existing.has(g.id)).length;
    const confirmation = await dialog.showMessageBox(win, {
      type: "question",
      title: "Revisar restauración",
      message: backup.legacy
        ? "Restaurar preferencias de una copia anterior"
        : "Restaurar biblioteca y portadas",
      detail: backup.legacy
        ? `Se aplicarán preferencias a ${backup.games.length - additions} juegos existentes. Esta copia antigua no contiene portadas ni permite agregar juegos.`
        : `${additions} juegos nuevos, ${backup.games.length - additions} juegos existentes y ${backup.artwork.length} portadas. Se reemplazarán las preferencias y portadas incluidas para esos juegos; los demás se conservan. Las rutas de juegos existentes se mantienen. Los juegos nuevos pueden incluir ejecutables y argumentos: restaura solo copias de confianza. No se ejecutará ningún juego. Las cuentas y carpetas vigiladas actuales se conservan.`,
      buttons: ["Cancelar", "Restaurar"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return false;
    return restoreBackup(store, backup, save);
  });
  handle("window:action", (action) => {
    if (action === "minimize") win.minimize();
    if (action === "maximize")
      win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === "close") win.close();
  });
}

module.exports = { registerIpc };
