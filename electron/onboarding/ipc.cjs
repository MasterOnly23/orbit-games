const crypto = require("node:crypto");
const { abortable } = require("../library/abortable.cjs");
const { scanLibrary, inspectManual } = require("../library/scanner.cjs");
const { mergeGames } = require("../library/model.cjs");
const { metadataOptions } = require("../library/metadata-options.cjs");
const {
  validateFolders,
  findExecutableCandidates,
  folderSuggestions,
  unknownCandidates,
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
  let searchController = null;
  const cancel = () => {
    if (!searchController) return false;
    searchController.abort(new Error("Búsqueda cancelada."));
    return true;
  };
  handle("setup:cancel", cancel);
  handle("setup:suggestions", () => folderSuggestions(desktop));
  handle("setup:preview", async (options) => {
    if (busy) throw new Error("La búsqueda anterior sigue en curso.");
    busy = true;
    preview = null;
    searchController = new AbortController();
    const { signal } = searchController;
    try {
      const folders = await abortable(
        () => validateFolders(options?.folders, { signal }),
        signal,
      );
      const gameFolders = await abortable(
        () => validateFolders(options?.gameFolders, { signal }),
        signal,
      );
      const scan = await abortable(
        () => scanLocal(folders, inventoryScript, { signal, gameFolders }),
        signal,
      );
      const extra = await findExecutableCandidates(gameFolders, { signal });
      signal.throwIfAborted();
      const games = mergeGames(scan.games);
      const candidates = unknownCandidates(extra.candidates, [
        ...games,
        ...store.data.games,
      ]);
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
    } catch (error) {
      if (signal.aborted) return { cancelled: true };
      throw error;
    } finally {
      searchController = null;
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
    const locale = metadataOptions({
      metadataLanguage:
        options.metadataLanguage ?? store.data.settings.metadataLanguage,
      metadataCountry:
        options.metadataCountry ?? store.data.settings.metadataCountry,
    });
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
        ...locale,
      };
      store.data.onboarding = { completedAt: new Date().toISOString() };
      store.data.scannedAt = preview.scan.scannedAt;
      store.data.warnings = preview.scan.warnings;
      store.data.discovery = {
        candidates: [],
        checkedAt: new Date().toISOString(),
      };
      await save();
      setWatchers([...preview.scan.watchPaths, ...preview.gameFolders]);
      preview = null;
      enrich().catch(report);
      return snapshot();
    } finally {
      busy = false;
    }
  });
  return { cancel };
}

module.exports = { registerOnboarding };
