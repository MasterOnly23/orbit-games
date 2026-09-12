const { normalize } = require("./model.cjs");
const { metadataOptions } = require("./metadata-options.cjs");
const cache = new Map();
async function json(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error("La tienda no está disponible. Inténtalo más tarde.");
  return response.json();
}
function localeQuery(settings) {
  const { metadataLanguage, metadataCountry } = metadataOptions(settings);
  return `l=${metadataLanguage}${metadataCountry ? `&cc=${metadataCountry}` : ""}`;
}
async function searchMetadata(name, settings) {
  const data = await json(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&${localeQuery(settings)}`,
  );
  return (data.items || [])
    .filter((i) => Number.isInteger(i.id))
    .slice(0, 8)
    .map((i) => ({ id: String(i.id), name: i.name, image: i.tiny_image }));
}
async function getMetadata(id, settings, { force = false } = {}) {
  if (!/^\d+$/.test(String(id)))
    throw new Error("El ID de Steam no es válido.");
  const locale = localeQuery(settings),
    cacheKey = `${id}:${locale}`;
  if (!force && cache.has(cacheKey)) return cache.get(cacheKey);
  const payload = await json(
    `https://store.steampowered.com/api/appdetails?appids=${id}&${locale}`,
  );
  const d = payload[id]?.data;
  if (!d) throw new Error("Steam no tiene una ficha pública para este juego.");
  const strip = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  const result = {
    steamId: String(id),
    title: d.name,
    description: strip(d.short_description),
    hero: d.screenshots?.[0]?.path_full || d.background_raw || d.header_image,
    header: d.header_image,
    cover: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`,
    genres: (d.genres || []).map((g) => g.description),
    developers: d.developers || [],
    publishers: d.publishers || [],
    releaseDate: d.release_date?.date || "",
    score: d.metacritic?.score || null,
    sourceUrl: `https://store.steampowered.com/app/${id}/`,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, result);
  return result;
}
async function matchMetadata(game, settings, options) {
  const selectedId = game.metadata?.steamId || game.steamId;
  if (selectedId) return getMetadata(selectedId, settings, options);
  const candidates = await searchMetadata(
    game.customName || game.name,
    settings,
  );
  const match = candidates.find(
    (c) => normalize(c.name) === normalize(game.customName || game.name),
  );
  return match ? getMetadata(match.id, settings, options) : null;
}
module.exports = { searchMetadata, getMetadata, matchMetadata };
