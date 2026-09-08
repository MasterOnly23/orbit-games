const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchEpicCatalog } = require("../electron/accounts/epic-catalog.cjs");
const {
  mergeAccountLibrary,
} = require("../electron/library/account-library.cjs");
const asset = { namespace: "sandbox", catalogItemId: "item", appName: "Game" };
test("Epic follows cursors and joins local installs by the same complete product identity", async () => {
  const catalog = await fetchEpicCatalog(async (address) => {
    const url = new URL(address);
    if (url.pathname.includes("library/api"))
      return url.searchParams.has("cursor")
        ? {
            records: [{ ...asset, catalogItemId: "dlc", appName: "DLC" }],
            responseMetadata: {},
          }
        : { records: [asset], responseMetadata: { nextCursor: "page-two" } };
    return {
      item: { title: "Game" },
      dlc: { title: "DLC", mainGameItem: { id: "item" } },
    };
  });
  assert.equal(catalog.games.length, 1);
  const installed = {
    id: "local",
    name: "Game",
    provider: "Epic Games",
    providerId: "sandbox:item:Game",
    favorite: true,
    status: "installed",
  };
  const merged = mergeAccountLibrary(
    [installed],
    { id: "account", provider: "Epic Games" },
    catalog,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "local");
  assert.equal(merged[0].status, "installed");
});
test("Epic rejects repeated cursors, malformed identities and missing catalog details", async () => {
  await assert.rejects(
    fetchEpicCatalog(async () => ({
      records: [],
      responseMetadata: { nextCursor: "loop" },
    })),
    /recorrer/,
  );
  await assert.rejects(
    fetchEpicCatalog(async () => ({
      records: [{ ...asset, namespace: "../other" }],
      responseMetadata: {},
    })),
    /identificador/,
  );
  await assert.rejects(
    fetchEpicCatalog(async (url) =>
      url.includes("library/api")
        ? { records: [asset], responseMetadata: {} }
        : {},
    ),
    /fichas/,
  );
  assert.deepEqual(
    await fetchEpicCatalog(async () => ({ records: [], responseMetadata: {} })),
    { complete: true, games: [] },
  );
});
