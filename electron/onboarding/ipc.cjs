const crypto = require("node:crypto");
const path = require("node:path");
const { scanLibrary, inspectManual } = require("../library/scanner.cjs");
const { mergeGames } = require("../library/model.cjs");
const {
  validateFolders,
  findExecutableCandidates,
  folderSuggestions,
} = require("./discovery.cjs");

function registerOnboarding({
  handle,
  store,
  save,
  snapshot,
  inventoryScript,
  setWatchers,
  enrich,
  report,
  desktop,
  scanLocal = scanLibrary,
}) {
  let preview = null,
    busy = false;
  handle("setup:suggestions", () => folderSuggestions(desktop));
  handle("setup:preview", async (options) => {
    if (busy) throw new Error("La búsqueda anterior sigue en curso.");
    busy = true;
    preview = null;
    try {
      const folders = await validateFolders(options?.folders);
      const gameFolders = await validateFolders(options?.gameFolders);
      const scan = await scanLocal(folders, inventoryScript);
      const extra = await findExecutableCandidates(gameFolders);
      const games = mergeGames(scan.games);
      const knownTargets = new Set(
        [...games, ...store.data.games]
          .flatMap((g) => [
            g.targetExecutable,
            g.launch?.kind === "file" && g.launch.target,
          ])
          .filter(Boolean)
          .map((p) => p.toLowerCase()),
      );
      const candidates = extra.candidates.filter(
        (c) =>
          !knownTargets.has(c.target.toLowerCase()) &&
          !games.some((g) => {
            if (!g.installPath) return false;
            const relative = path.relative(g.installPath, c.target);
            return (
              relative &&
              !relative.startsWith("..") &&
              !path.isAbsolute(relative)
            );
          }),
      );
      preview = {
        id: crypto.randomUUID(),
        folders,
        gameFolders,
        scan,
        candidates,
      };
      return {
        id: preview.id,
        count: games.length,
        platforms: Object.entries(
          games.reduce((all, g) => {
            all[g.provider] = (all[g.provider] || 0) + 1;
            return all;
          }, {}),
        ).map(([name, count]) => ({ name, count })),
        locations: [
          ...new Set(games.map((g) => g.installPath).filter(Boolean)),
        ],
        candidates,
        warnings: [...scan.warnings, ...extra.warnings],
      };
    } finally {
      busy = false;
    }
  });
  handle("setup:complete", async (options) => {
    if (busy) throw new Error("Espera a que termine la operación anterior.");
    if (!preview || options?.previewId !== preview.id)
      throw new Error(
        "Vuelve a buscar juegos antes de guardar la configuración.",
      );
    const selected = options.selectedCandidates;
    if (
      !Array.isArray(selected) ||
      selected.length > 200 ||
      selected.some((id) => !preview.candidates.some((c) => c.id === id))
    )
      throw new Error("La selección de ejecutables no es válida.");
    if (typeof options.onlineMetadata !== "boolean")
      throw new Error("Indica si quieres consultar las fichas en línea.");
    busy = true;
    try {
      const manual = [];
      for (const candidate of preview.candidates.filter((c) =>
        selected.includes(c.id),
      ))
        manual.push(
          await inspectManual(
            candidate.target,
            candidate.name,
            inventoryScript,
          ),
        );
      store.data.games = mergeGames(
        [...preview.scan.games, ...manual],
        store.data.games,
      );
      store.data.settings = {
        ...store.data.settings,
        folders: preview.folders,
        gameFolders: preview.gameFolders,
        onlineMetadata: options.onlineMetadata,
      };
      store.data.onboarding = { completedAt: new Date().toISOString() };
      store.data.scannedAt = preview.scan.scannedAt;
      store.data.warnings = preview.scan.warnings;
      await save();
      setWatchers(preview.scan.watchPaths);
      preview = null;
      enrich().catch(report);
      return snapshot();
    } finally {
      busy = false;
    }
  });
}

module.exports = { registerOnboarding };
