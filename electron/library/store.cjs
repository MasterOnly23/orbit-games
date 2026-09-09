const fs = require("node:fs/promises");
const path = require("node:path");
function parseLibrary(content) {
  const value = JSON.parse(content);
  if (Number.isInteger(value?.version) && value.version !== 1) {
    const error = new Error(
      `La biblioteca usa el formato ${value.version}, incompatible con esta versión de Orbit Next. Abre la aplicación que creó la biblioteca o una versión compatible. Los archivos no se han modificado.`,
    );
    error.code = "UNSUPPORTED_LIBRARY_VERSION";
    throw error;
  }
  const object = (item) =>
    !!item && typeof item === "object" && !Array.isArray(item);
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.games) ||
    (value.accounts !== undefined && !Array.isArray(value.accounts)) ||
    ["settings", "onboarding", "discovery"].some(
      (key) => value[key] !== undefined && !object(value[key]),
    )
  ) {
    const error = new Error("Formato de biblioteca no válido.");
    error.code = "INVALID_LIBRARY";
    throw error;
  }
  return value;
}
class LibraryStore {
  constructor(directory, desktop) {
    this.directory = directory;
    this.file = path.join(directory, "library.json");
    this.queue = Promise.resolve();
    this.writable = false;
    this.data = {
      version: 1,
      games: [],
      accounts: [],
      discovery: { candidates: [], checkedAt: null },
      settings: {
        folders: [],
        gameFolders: [],
        autoScan: true,
        onlineMetadata: false,
        closeToTray: false,
        minimizeOnLaunch: false,
      },
      scannedAt: null,
      onboarding: { completedAt: null },
      warnings: [],
    };
  }
  async load() {
    this.writable = false;
    this.recoveredFromBackup = false;
    await fs.mkdir(this.directory, { recursive: true });
    let stored;
    try {
      stored = parseLibrary(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code === "UNSUPPORTED_LIBRARY_VERSION") throw error;
      // Access and device errors are not evidence of corrupt data. Do not
      // replace an unreadable current library with an older backup.
      if (
        !(error instanceof SyntaxError) &&
        !["ENOENT", "INVALID_LIBRARY"].includes(error.code)
      )
        throw error;
      try {
        stored = parseLibrary(await fs.readFile(`${this.file}.bak`, "utf8"));
        this.recoveredFromBackup = true;
      } catch (backupError) {
        if (backupError.code === "UNSUPPORTED_LIBRARY_VERSION")
          throw backupError;
        if (error.code === "ENOENT" && backupError.code === "ENOENT") {
          this.writable = true;
          return this.data;
        }
        throw new Error(
          `No se puede abrir la biblioteca. Se conservan los archivos para recuperarlos: ${this.file}`,
        );
      }
    }
    this.data = {
      ...this.data,
      ...stored,
      settings: { ...this.data.settings, ...stored.settings },
      onboarding: { ...this.data.onboarding, ...stored.onboarding },
      discovery: { ...this.data.discovery, ...stored.discovery },
    };
    if (this.recoveredFromBackup)
      this.data.warnings = [
        "Se recuperó la copia de respaldo de la biblioteca.",
      ];
    this.writable = true;
    return this.data;
  }
  save() {
    if (!this.writable)
      return Promise.reject(
        new Error(
          "La biblioteca no se abrió correctamente. No se guardarán cambios sobre sus archivos.",
        ),
      );
    if (this.data.version !== 1)
      return Promise.reject(
        new Error("No se puede guardar un formato de biblioteca incompatible."),
      );
    const content = JSON.stringify(this.data, null, 2);
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        const temporary = `${this.file}.tmp`;
        await fs.writeFile(temporary, content, "utf8");
        try {
          if (!this.recoveredFromBackup)
            await fs.copyFile(this.file, `${this.file}.bak`);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        await fs.rename(temporary, this.file);
        this.recoveredFromBackup = false;
      });
    return this.queue;
  }
  getGame(id) {
    const game = this.data.games.find((g) => g.id === id);
    if (!game) throw new Error("El juego ya no está en la biblioteca.");
    return game;
  }
}
module.exports = { LibraryStore };
