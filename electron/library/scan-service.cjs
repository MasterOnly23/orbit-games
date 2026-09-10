const { abortable } = require("./abortable.cjs");
const { mergeGames } = require("./model.cjs");
const { unknownCandidates } = require("../onboarding/discovery.cjs");

function createScanService({
  store,
  scanLocal,
  discover,
  availability,
  snapshot,
  setScanning,
  setWatchers,
  onError,
  onCommitted,
}) {
  let running = false,
    controller = null;
  return {
    cancel() {
      if (!controller) return false;
      controller.abort(new Error("Detección cancelada."));
      return true;
    },
    async run() {
      if (!store.data.onboarding?.completedAt || running) return snapshot();
      running = true;
      controller = new AbortController();
      const { signal } = controller;
      let cancelled = false;
      setScanning(true);
      try {
        const folders = [...store.data.settings.folders];
        const gameFolders = [...(store.data.settings.gameFolders || [])];
        const result = await abortable(
          () => scanLocal(folders, { signal }),
          signal,
        );
        const checked = new Map();
        for (const game of store.data.games.filter(
          (game) => game.manual && game.launch?.kind === "file",
        )) {
          const target = game.targetExecutable || game.launch.target;
          const state = await abortable(() => availability(target), signal);
          checked.set(game.id, { target, state });
        }
        const extra = await abortable(
          () => discover(gameFolders, { signal }),
          signal,
        );
        signal.throwIfAborted();
        // Merge only after every read succeeds, using the latest user edits.
        const games = mergeGames(result.games, store.data.games).map((game) => {
          const check = checked.get(game.id);
          return game.manual &&
            check &&
            check.target === (game.targetExecutable || game.launch?.target)
            ? { ...game, ...check.state }
            : game;
        });
        const previous = {
          games: store.data.games,
          discovery: store.data.discovery,
          scannedAt: store.data.scannedAt,
          warnings: store.data.warnings,
        };
        const changes = {
          games,
          discovery: {
            candidates: unknownCandidates(extra.candidates, games),
            checkedAt: new Date().toISOString(),
          },
          scannedAt: result.scannedAt,
          warnings: [...result.warnings, ...extra.warnings],
        };
        controller = null; // A complete snapshot already being saved must finish.
        Object.assign(store.data, changes);
        try {
          await store.save();
        } catch (error) {
          for (const key of Object.keys(changes))
            if (store.data[key] === changes[key])
              store.data[key] = previous[key];
          throw error;
        }
        setWatchers([...result.watchPaths, ...gameFolders]);
      } catch (error) {
        if (signal.aborted) cancelled = true;
        else {
          onError(error);
          throw error;
        }
      } finally {
        controller = null;
        running = false;
        setScanning(false);
      }
      if (cancelled) return { ...snapshot(), scanCancelled: true };
      onCommitted();
      return snapshot();
    },
  };
}
module.exports = { createScanService };
