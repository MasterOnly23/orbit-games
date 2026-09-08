const { BrowserWindow, session } = require("electron");
const { ProviderError } = require("./provider-error.cjs");
const windows = new Set();

function allowedNavigation(value, hosts) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

async function readProviderSession({
  parent,
  partition,
  provider,
  interactive,
  signal,
}) {
  if (signal?.aborted)
    throw new ProviderError("cancelled", "Conexión cancelada.");
  const isolated = session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 980,
      height: 800,
      minWidth: 700,
      minHeight: 600,
      show: interactive,
      parent,
      modal: interactive,
      autoHideMenuBar: true,
      title: `Conectar ${provider.name} — Orbit Next`,
      webPreferences: {
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        devTools: false,
      },
    });
    windows.add(win);
    if (provider.userAgentSuffix)
      win.webContents.setUserAgent(
        win.webContents.getUserAgent() + provider.userAgentSuffix,
      );
    let settled = false,
      checking = false;
    const preventDownload = (event) => event.preventDefault();
    isolated.on("will-download", preventDownload);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancelled);
      isolated.removeListener("will-download", preventDownload);
      windows.delete(win);
      if (!win.isDestroyed()) win.destroy();
      if (error) reject(error);
      else resolve(result);
    };
    const cancelled = () =>
      finish(new ProviderError("cancelled", "Conexión cancelada."));
    const check = async () => {
      if (
        settled ||
        checking ||
        win.isDestroyed() ||
        !provider.sessionHosts.includes(
          new URL(win.webContents.getURL() || "about:blank").hostname,
        )
      )
        return;
      checking = true;
      try {
        // The provider's session material goes only to the Electron main process.
        // There is no Orbit preload or app IPC bridge in this remote window.
        const value = provider.readSession
          ? await provider.readSession({
              fetchImpl: isolated.fetch.bind(isolated),
            })
          : await win.webContents.executeJavaScript(provider.readSessionScript);
        if (value && provider.validSession(value))
          finish(null, {
            ...value,
            ...(provider.usesBrowserSession
              ? { fetchImpl: isolated.fetch.bind(isolated) }
              : {}),
          });
        else if (!interactive && !win.webContents.isLoading())
          finish(
            new ProviderError(
              "auth-required",
              `Vuelve a conectar tu cuenta de ${provider.name}.`,
            ),
          );
      } catch {
        if (!interactive)
          finish(
            new ProviderError(
              "auth-required",
              `No se pudo renovar la sesión de ${provider.name}. Vuelve a conectar la cuenta.`,
            ),
          );
      } finally {
        checking = false;
      }
    };
    const poll = setInterval(() => {
      check().catch(() => {});
    }, 1500);
    const timeout = setTimeout(
      () =>
        finish(
          new ProviderError(
            "timeout",
            interactive
              ? "La conexión no se completó. Puedes intentarlo de nuevo."
              : "La plataforma no respondió a tiempo.",
          ),
        ),
      interactive ? 10 * 60000 : 30000,
    );
    signal?.addEventListener("abort", cancelled, { once: true });
    if (signal?.aborted) {
      cancelled();
      return;
    }
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const event of ["will-navigate", "will-redirect"])
      win.webContents.on(event, (e, url) => {
        const authorization = provider.captureAuthorization?.(url);
        if (authorization) {
          e.preventDefault();
          finish(null, authorization);
          return;
        }
        if (!allowedNavigation(url, provider.navigationHosts))
          e.preventDefault();
      });
    win.webContents.on("will-attach-webview", (event) =>
      event.preventDefault(),
    );
    win.webContents.on("page-title-updated", (event) => event.preventDefault());
    win.webContents.on("did-finish-load", () => {
      check().catch(() => {});
    });
    win.on("closed", () => {
      if (!settled) cancelled();
    });
    win
      .loadURL(provider.sessionUrl)
      .catch(() =>
        finish(
          new ProviderError(
            "network",
            `No se pudo abrir ${provider.name}. Revisa la conexión a Internet.`,
          ),
        ),
      );
  });
}

async function clearProviderSession(partition) {
  const isolated = session.fromPartition(partition);
  await isolated.clearStorageData();
  await isolated.clearCache();
}
module.exports = {
  readProviderSession,
  clearProviderSession,
  allowedNavigation,
};
