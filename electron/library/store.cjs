const fs = require("node:fs/promises");
const path = require("node:path");
class LibraryStore {
  constructor(directory, desktop) {
    this.directory = directory;
    this.file = path.join(directory, "library.json");
    this.queue = Promise.resolve();
    this.data = {
      version: 1,
      games: [],
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
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const stored = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (stored.version !== 1 || !Array.isArray(stored.games))
        throw new Error("Formato de biblioteca no compatible.");
      this.data = {
        ...this.data,
        ...stored,
        settings: { ...this.data.settings, ...stored.settings },
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        try {
          const backup = JSON.parse(
            await fs.readFile(`${this.file}.bak`, "utf8"),
          );
          if (!Array.isArray(backup.games)) throw error;
          this.data = { ...this.data, ...backup };
          this.data.warnings = [
            "Se recuperó la copia de respaldo de la biblioteca.",
          ];
        } catch {
          throw new Error(
            `No se puede abrir la biblioteca. Se conserva el archivo para recuperarlo: ${this.file}`,
          );
        }
      }
    }
    return this.data;
  }
  save() {
    const content = JSON.stringify(this.data, null, 2);
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        const temporary = `${this.file}.tmp`;
        await fs.writeFile(temporary, content, "utf8");
        try {
          await fs.copyFile(this.file, `${this.file}.bak`);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        await fs.rename(temporary, this.file);
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
