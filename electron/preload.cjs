const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("orbit", {
  cancelAccounts: () => ipcRenderer.invoke("accounts:cancel"),
  connectAccount: (provider) =>
    ipcRenderer.invoke("accounts:connect", provider),
  syncAccount: (id) => ipcRenderer.invoke("accounts:sync", id),
  disconnectAccount: (id) => ipcRenderer.invoke("accounts:disconnect", id),
  setupSuggestions: () => ipcRenderer.invoke("setup:suggestions"),
  setupPreview: (options) => ipcRenderer.invoke("setup:preview", options),
  setupComplete: (options) => ipcRenderer.invoke("setup:complete", options),
  getLibrary: () => ipcRenderer.invoke("library:get"),
  scan: () => ipcRenderer.invoke("library:scan"),
  updateGame: (id, patch) => ipcRenderer.invoke("game:update", id, patch),
  addGame: (payload) => ipcRenderer.invoke("game:add", payload),
  launch: (id) => ipcRenderer.invoke("game:launch", id),
  openLauncher: (id) => ipcRenderer.invoke("game:launcher", id),
  reveal: (id) => ipcRenderer.invoke("game:reveal", id),
  pickFile: () => ipcRenderer.invoke("dialog:file"),
  pickFolder: () => ipcRenderer.invoke("dialog:folder"),
  settings: (patch) => ipcRenderer.invoke("settings:update", patch),
  metadataSearch: (query) => ipcRenderer.invoke("metadata:search", query),
  metadataApply: (id, steamId) =>
    ipcRenderer.invoke("metadata:apply", id, steamId),
  metadataRefresh: (id) => ipcRenderer.invoke("metadata:refresh", id),
  chooseArtwork: (id) => ipcRenderer.invoke("artwork:choose", id),
  clearArtwork: (id) => ipcRenderer.invoke("artwork:clear", id),
  openSource: (id) => ipcRenderer.invoke("metadata:source", id),
  accountProviders: () => ipcRenderer.invoke("accounts:providers"),
  cancelSetup: () => ipcRenderer.invoke("setup:cancel"),
  exportLibrary: () => ipcRenderer.invoke("library:export"),
  importLibrary: () => ipcRenderer.invoke("library:import"),
  window: (action) => ipcRenderer.invoke("window:action", action),
  onChange: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("library:changed", handler);
    return () => ipcRenderer.removeListener("library:changed", handler);
  },
});
