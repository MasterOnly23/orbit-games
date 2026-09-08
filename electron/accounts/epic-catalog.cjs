const { ProviderError } = require("./provider-error.cjs");

// Read-only catalog protocol. Authentication is supplied by the account connector.
async function fetchEpicCatalog(request) {
  const assets = [],
    cursors = new Set(),
    products = new Set();
  let cursor = null;
  for (let page = 0; page < 500; page++) {
    const url = new URL(
      "https://library-service.live.use1a.on.epicgames.com/library/api/public/items",
    );
    url.searchParams.set("includeMetadata", "true");
    url.searchParams.set("platform", "Windows");
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await request(url.href);
    if (!Array.isArray(data?.records) || !data.responseMetadata)
      throw new ProviderError(
        "incomplete",
        "Epic no devolvió una página completa de la biblioteca.",
      );
    for (const asset of data.records) {
      if (
        ![asset.namespace, asset.catalogItemId, asset.appName].every(
          (value) =>
            typeof value === "string" && /^[a-zA-Z0-9_-]{1,256}$/.test(value),
        )
      )
        throw new ProviderError(
          "invalid-response",
          "Epic devolvió un identificador de juego no válido.",
        );
      const productId = [
        asset.namespace,
        asset.catalogItemId,
        asset.appName,
      ].join(":");
      if (products.has(productId))
        throw new ProviderError(
          "incomplete",
          "Epic repitió una entrada durante la consulta. Vuelve a sincronizar.",
        );
      products.add(productId);
      assets.push({ ...asset, productId });
    }
    cursor = data.responseMetadata.nextCursor;
    if (cursor === null || cursor === undefined || cursor === "") break;
    if (
      typeof cursor !== "string" ||
      cursor.length > 4096 ||
      cursors.has(cursor) ||
      page === 499
    )
      throw new ProviderError(
        "incomplete",
        "No se pudo recorrer toda la biblioteca de Epic.",
      );
    cursors.add(cursor);
  }
  const games = [];
  // Cache catalog entries shared by multiple executable assets, preserving editions.
  const metadata = new Map();
  for (const asset of assets) {
    const key = `${asset.namespace}:${asset.catalogItemId}`;
    let item = metadata.get(key);
    if (!item) {
      const url = new URL(
        `https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/${asset.namespace}/bulk/items`,
      );
      url.search = new URLSearchParams({
        id: asset.catalogItemId,
        country: "US",
        locale: "en-US",
        includeMainGameDetails: "true",
      }).toString();
      const response = await request(url.href);
      item = response?.[asset.catalogItemId];
      if (!item || typeof item.title !== "string" || !item.title.trim())
        throw new ProviderError(
          "incomplete",
          "Faltan fichas de juegos en la respuesta de Epic. Se conserva tu biblioteca.",
        );
      metadata.set(key, item);
    }
    // DLC belongs to its base game and must not masquerade as a launchable game.
    if (item.mainGameItem?.id) continue;
    games.push({
      productId: asset.productId,
      name: item.title.trim(),
      access: "unknown",
      launch: {
        kind: "uri",
        target: `com.epicgames.launcher://apps/${encodeURIComponent(asset.productId)}?action=launch&silent=true`,
      },
    });
  }
  return { complete: true, games };
}
module.exports = { fetchEpicCatalog };
