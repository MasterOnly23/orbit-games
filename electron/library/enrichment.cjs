const { matchMetadata } = require("./metadata.cjs");

function createEnrichmentService({ store, save, isQuitting }) {
  let metadataRunning = false;
  async function run() {
    if (isQuitting() || metadataRunning || !store.data.settings.onlineMetadata)
      return;
    metadataRunning = true;
    try {
      for (const candidate of store.data.games) {
        if (isQuitting() || !store.data.settings.onlineMetadata) break;
        if (
          candidate.metadata ||
          candidate.hidden ||
          (candidate.metadataCheckedAt &&
            Date.now() - Date.parse(candidate.metadataCheckedAt) < 7 * 86400000)
        )
          continue;
        try {
          const meta = await matchMetadata(candidate);
          const current = store.getGame(candidate.id);
          if (!current.metadata) current.metadata = meta;
          current.metadataCheckedAt = new Date().toISOString();
          await save();
        } catch {
          // A failed request is not a negative match. Retry on a later scan.
        }
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      await store.save();
    } finally {
      metadataRunning = false;
    }
  }

  return { run };
}
module.exports = { createEnrichmentService };
