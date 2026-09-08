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
  handle("library:scan", scan);
  handle("game:update", async (id, patch) => {
    const g = store.getGame(id);
    const changes = {};
    if (!patch || typeof patch !== "object")
      throw new Error("Cambios no válidos.");
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
      title: "Guardar respaldo",
      defaultPath: "Orbit Games - respaldo.json",
      filters: [{ name: "Respaldo JSON", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    await fsp.writeFile(
      result.filePath,
      JSON.stringify(
        {
          version: 1,
          preferences: store.data.games.map((g) => ({
            id: g.id,
            name: g.name,
            provider: g.provider,
            favorite: g.favorite,
            hidden: g.hidden,
            notes: g.notes,
            customName: g.customName,
            statusOverride: g.statusOverride,
            lastPlayed: g.lastPlayed,
            metadata: g.metadata,
          })),
          settings: { folders: store.data.settings.folders },
        },
        null,
        2,
      ),
      "utf8",
    );
    return true;
  });
  handle("library:import", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Restaurar preferencias",
      properties: ["openFile"],
      filters: [{ name: "Respaldo JSON", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    const stat = await fsp.stat(result.filePaths[0]);
    if (stat.size > 10 * 1024 * 1024)
      throw new Error("El respaldo supera el tamaño permitido.");
    const data = JSON.parse(await fsp.readFile(result.filePaths[0], "utf8"));
    if (data.version !== 1 || !Array.isArray(data.preferences))
      throw new Error("Este archivo no es un respaldo de Orbit Games.");
    let count = 0;
    for (const pref of data.preferences) {
      const g = store.data.games.find((g) => g.id === pref.id);
      if (!g) continue;
      for (const k of ["favorite", "hidden"])
        if (typeof pref[k] === "boolean") g[k] = pref[k];
      for (const k of ["notes", "customName"])
        if (typeof pref[k] === "string")
          g[k] = pref[k].slice(0, k === "notes" ? 5000 : 200);
      if (
        ["auto", "installed", "uninstalled", "unknown"].includes(
          pref.statusOverride,
        )
      )
        g.statusOverride = pref.statusOverride;
      count++;
    }
    await save();
    return count;
  });
  handle("window:action", (action) => {
    if (action === "minimize") win.minimize();
    if (action === "maximize")
      win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === "close") win.close();
  });
}

module.exports = { registerIpc };
