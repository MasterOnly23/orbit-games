const { createMainWindow } = require("./desktop/main-window.cjs");
const { registerAccounts } = require("./accounts/register.cjs");
const { createEnrichmentService } = require("./library/enrichment.cjs");
const { createScanService } = require("./library/scan-service.cjs");
const { createLifecycle } = require("./lifecycle.cjs");
const { isTrustedAppSender } = require("./ipc-origin.cjs");

const { artworkName } = require("./library/backup.cjs");
const { app, ipcMain, dialog, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { LibraryStore } = require("./library/store.cjs");
const { scanLibrary } = require("./library/scanner.cjs");

const { registerIpc } = require("./ipc.cjs");
const { identity, configureRuntime } = require("./runtime.cjs");
const { registerOnboarding } = require("./onboarding/ipc.cjs");

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
let libraryScan, enrichment;
async function scan() {
  if (quitting) return snapshot();
  return lifecycle.run(() => (libraryScan ? libraryScan.run() : snapshot()));
}
function enrich() {
  if (quitting) return Promise.resolve();
  return lifecycle.run(() => enrichment.run());
}
function handle(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedAppSender(event, win?.webContents, { devUrl, indexPath }))
      throw new Error("Origen no autorizado.");
    return lifecycle.run(() => callback(...args));
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
      enrichment = createEnrichmentService({
        store,
        save,
        isQuitting: () => quitting,
      });
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
      ({ win, tray } = createMainWindow({
        store,
        isQuitting: () => quitting,
        canClose: () => shutdownReady,
        scan,
        report,
        devUrl,
        indexPath,
        appRoot: path.join(__dirname, ".."),
      }));
      accounts = registerAccounts({
        store,
        save,
        win,
        handle,
        itchClientId: process.env.ORBIT_ITCH_CLIENT_ID,
      });
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
