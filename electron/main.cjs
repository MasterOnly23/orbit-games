const { createScanService } = require("./library/scan-service.cjs");
const { createLifecycle } = require("./lifecycle.cjs");
const { isTrustedAppSender } = require("./ipc-origin.cjs");
const { createItchProvider } = require("./accounts/itch.cjs");
const { artworkName } = require("./library/backup.cjs");
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  Tray,
  nativeImage,
  protocol,
  net,
  safeStorage,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { LibraryStore } = require("./library/store.cjs");
const { scanLibrary, exists } = require("./library/scanner.cjs");
const { matchMetadata } = require("./library/metadata.cjs");
const { registerIpc } = require("./ipc.cjs");
const { identity, configureRuntime } = require("./runtime.cjs");
const { registerOnboarding } = require("./onboarding/ipc.cjs");
const { createAccountService } = require("./accounts/service.cjs");
const {
  readProviderSession,
  clearProviderSession,
} = require("./accounts/auth-window.cjs");
const { steam } = require("./accounts/steam.cjs");
const { gog } = require("./accounts/gog.cjs");
const { epic } = require("./accounts/epic.cjs");
const { humble } = require("./accounts/humble.cjs");
const { ubisoft } = require("./accounts/ubisoft.cjs");
const { CredentialVault } = require("./accounts/vault.cjs");
const { findExecutableCandidates } = require("./onboarding/discovery.cjs");
const { fileAvailability } = require("./library/availability.cjs");
configureRuntime(app);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "orbit-art",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
const locked = app.requestSingleInstanceLock();
const lifecycle = createLifecycle();
let shutdownReady = false,
  shutdownTask,
  accounts,
  onboarding;
if (!locked) {
  app.quit();
}
let win,
  store,
  tray,
  quitting = false,
  scanning = false,
  metadataRunning = false,
  scanTimer,
  watchers = [];
const indexPath = path.join(__dirname, "..", "dist", "index.html");
const devUrl = !app.isPackaged && process.env.ORBIT_DEV_URL;
const inventoryScript = app.isPackaged
  ? path.join(process.resourcesPath, "inventory.ps1")
  : path.join(__dirname, "platform", "inventory.ps1");
const loginOptions = () => ({
  name: identity.loginName,
  path: process.execPath,
  args: app.isPackaged ? ["--startup"] : [app.getAppPath(), "--startup"],
});
function snapshot() {
  return {
    ...store.data,
    scanning,
    settings: {
      ...store.data.settings,
      startWithWindows: app.getLoginItemSettings(loginOptions()).openAtLogin,
    },
    version: app.getVersion(),
    appName: identity.name,
  };
}
function notify() {
  if (win && !win.isDestroyed())
    win.webContents.send("library:changed", snapshot());
}
async function save() {
  await store.save();
  notify();
}
function setWatchers(paths) {
  clearTimeout(scanTimer);
  watchers.forEach((w) => w.close());
  watchers = [];
  if (quitting || !store.data.settings.autoScan) return;
  for (const dir of paths) {
    try {
      const watcher = fs.watch(dir, { recursive: false }, () => {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          if (store.data.settings.autoScan) scan().catch(report);
        }, 1800);
      });
      watcher.on("error", () => {});
      watchers.push(watcher);
    } catch {}
  }
}
function report(error) {
  store.data.warnings = [error.message];
  notify();
}
let libraryScan;
async function scan() {
  if (quitting) return snapshot();
  return lifecycle.run(() => (libraryScan ? libraryScan.run() : snapshot()));
}
function enrich() {
  if (quitting) return Promise.resolve();
  return lifecycle.run(enrichLibrary);
}
async function enrichLibrary() {
  if (quitting || metadataRunning || !store.data.settings.onlineMetadata)
    return;
  metadataRunning = true;
  try {
    for (const candidate of store.data.games) {
      if (quitting || !store.data.settings.onlineMetadata) break;
      if (
        candidate.metadata ||
        candidate.hidden ||
        (candidate.metadataCheckedAt &&
          Date.now() - Date.parse(candidate.metadataCheckedAt) < 7 * 86400000)
      )
        continue;
      try {
        const meta = await matchMetadata(candidate);
        const current = store.getGame(candidate.id);
        if (!current.metadata) current.metadata = meta;
        current.metadataCheckedAt = new Date().toISOString();
        await save();
      } catch {
        // A failed request is not a negative match. Retry on a later scan.
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    await store.save();
  } finally {
    metadataRunning = false;
  }
}
function handle(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedAppSender(event, win?.webContents, { devUrl, indexPath }))
      throw new Error("Origen no autorizado.");
    return lifecycle.run(() => callback(...args));
  });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 950,
    minWidth: 1000,
    minHeight: 700,
    title: identity.name,
    backgroundColor: "#0d1016",
    show: false,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#101319", symbolColor: "#bfc3ce", height: 38 },
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_w, _p, callback) =>
    callback(false),
  );
  win.on("close", (event) => {
    if (store.data.settings.closeToTray && !quitting) {
      event.preventDefault();
      win.hide();
    } else if (!shutdownReady) {
      event.preventDefault();
      app.quit();
    }
  });
  win.once("ready-to-show", () => win.show());
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(indexPath);
  win.on("focus", () => {
    if (
      store.data.onboarding?.completedAt &&
      store.data.settings.autoScan &&
      Date.now() - Date.parse(store.data.scannedAt || 0) > 180000
    )
      scan().catch(report);
  });
  Menu.setApplicationMenu(null);
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "assets", "icon.ico"),
  );
  tray = new Tray(icon);
  tray.setToolTip(identity.name);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Abrir Orbit Games Next",
        click: () => {
          win.show();
          win.focus();
        },
      },
      { label: "Buscar juegos nuevos", click: () => scan().catch(report) },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]),
  );
  tray.on("double-click", () => {
    win.show();
    win.focus();
  });
}
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
app.on("before-quit", (event) => {
  if (shutdownReady || !store) return;
  event.preventDefault();
  if (shutdownTask) return;
  quitting = true;
  clearTimeout(scanTimer);
  watchers.forEach((w) => w.close());
  watchers = [];
  shutdownTask = lifecycle
    .drain(
      () => {
        libraryScan?.cancel();
        accounts?.cancel();
        onboarding?.cancel();
      },
      () => store.flush(),
    )
    .then(() => {
      shutdownReady = true;
      app.quit();
    })
    .catch(() => {
      quitting = false;
      lifecycle.resume();
      if (win && !win.isDestroyed()) win.show();
      dialog.showErrorBox(
        "No se pudo terminar de guardar",
        "Orbit sigue abierto porque falló el guardado de la biblioteca. Comprueba el espacio y el acceso al disco, vuelve a guardar tus cambios e intenta salir de nuevo.",
      );
      if (store.writable)
        setWatchers([
          ...store.data.settings.folders,
          ...(store.data.settings.gameFolders || []),
        ]);
    })
    .finally(() => {
      shutdownTask = null;
    });
});
app.on("window-all-closed", () => app.quit());
if (locked)
  app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId(identity.appId);
      store = new LibraryStore(app.getPath("userData"), app.getPath("desktop"));
      await store.load();
      libraryScan = createScanService({
        store,
        snapshot,
        scanLocal: (folders, options) =>
          scanLibrary(folders, inventoryScript, options),
        discover: findExecutableCandidates,
        availability: fileAvailability,
        setScanning: (value) => {
          scanning = value;
          notify();
        },
        setWatchers,
        onError: report,
        onCommitted: () => enrich().catch(report),
      });
      handle("library:cancel", () => libraryScan.cancel());

      protocol.handle("orbit-art", (request) => {
        const url = new URL(request.url);
        const id = url.pathname.slice(1);
        if (url.hostname !== "game" || !/^\w{20}$/.test(id))
          return new Response("Not found", { status: 404 });
        const game = store.data.games.find((entry) => entry.id === id);
        if (!game) return new Response("Not found", { status: 404 });
        return net.fetch(
          pathToFileURL(
            path.join(store.directory, "artwork", artworkName(game)),
          ).href,
        );
      });
      createWindow();
      const vault = new CredentialVault(store.directory, safeStorage);
      const itch = createItchProvider(process.env.ORBIT_ITCH_CLIENT_ID);
      const providers = {
        steam,
        gog,
        epic,
        humble,
        ubisoft,
        ...(itch ? { itch } : {}),
      };
      accounts = createAccountService({
        store,
        save,
        readSession: (options) =>
          options.provider.connectSession
            ? options.provider.connectSession({
                ...options,
                vault,
                readAuth: (provider = options.provider) =>
                  readProviderSession({ ...options, provider, parent: win }),
              })
            : readProviderSession({ ...options, parent: win }),
        clearSession: async (partition, id) => {
          await clearProviderSession(partition);
          await vault.remove(id);
        },
        providers,
      });
      handle("accounts:providers", () =>
        Object.values(providers).map((provider) => ({
          id: provider.id,
          name: provider.name === "Ubisoft" ? "Ubisoft Connect" : provider.name,
        })),
      );
      handle("accounts:connect", (provider) => accounts.connect(provider));
      handle("accounts:cancel", () => accounts.cancel());
      handle("accounts:sync", (id) => accounts.sync(id));
      handle("accounts:disconnect", (id) => accounts.disconnect(id));
      registerIpc({
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
      });
      onboarding = registerOnboarding({
        handle,
        store,
        save,
        snapshot,
        inventoryScript,
        setWatchers,
        enrich,
        report,
        desktop: app.getPath("desktop"),
      });
      if (!process.env.ORBIT_SKIP_SCAN) scan().catch(report);
      setInterval(() => {
        if (store.data.settings.autoScan && !quitting) scan().catch(report);
      }, 300000).unref();
    })
    .catch((error) => {
      dialog.showErrorBox("No se pudo abrir Orbit Games", error.message);
      app.quit();
    });
