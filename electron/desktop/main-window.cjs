const { app, BrowserWindow, Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const { identity } = require("../runtime.cjs");

function createMainWindow({
  store,
  isQuitting,
  canClose,
  scan,
  report,
  devUrl,
  indexPath,
  appRoot,
}) {
  const win = new BrowserWindow({
    width: 1480,
    height: 950,
    minWidth: 1000,
    minHeight: 700,
    title: identity.name,
    backgroundColor: "#0d1016",
    show: false,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#101319", symbolColor: "#bfc3ce", height: 38 },
    icon: path.join(appRoot, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(appRoot, "electron", "preload.cjs"),
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
    if (store.data.settings.closeToTray && !isQuitting()) {
      event.preventDefault();
      win.hide();
    } else if (!canClose()) {
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
    path.join(appRoot, "assets", "icon.ico"),
  );
  const tray = new Tray(icon);
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
  return { win, tray };
}

module.exports = { createMainWindow };
