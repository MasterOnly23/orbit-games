const { app, dialog, shell } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const { createDiagnostics } = require("../library/diagnostics.cjs");

function registerDiagnostics({ handle, win, store, connectorMetadata }) {
  handle("support:open", () =>
    shell.openExternal("https://github.com/MasterOnly23/orbit-games/issues"),
  );
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
      connectors: connectorMetadata(),
    });
    await fs.writeFile(
      result.filePath,
      JSON.stringify(diagnostic, null, 2),
      "utf8",
    );
    return true;
  });
}
module.exports = { registerDiagnostics };
