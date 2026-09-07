const { normalize } = require("./model.cjs");
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
async function searchMetadata(name) {
  const data = await json(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=spanish&cc=AR`,
  );
  return (data.items || [])
    .filter((i) => Number.isInteger(i.id))
    .slice(0, 8)
    .map((i) => ({ id: String(i.id), name: i.name, image: i.tiny_image }));
}
async function getMetadata(id) {
  if (!/^\d+$/.test(String(id)))
    throw new Error("El ID de Steam no es válido.");
  if (cache.has(id)) return cache.get(id);
  const payload = await json(
    `https://store.steampowered.com/api/appdetails?appids=${id}&l=spanish`,
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
  cache.set(id, result);
  return result;
}
async function matchMetadata(game) {
  if (game.steamId) return getMetadata(game.steamId);
  const candidates = await searchMetadata(game.customName || game.name);
  const match = candidates.find(
    (c) => normalize(c.name) === normalize(game.customName || game.name),
  );
  return match ? getMetadata(match.id) : null;
}
module.exports = { searchMetadata, getMetadata, matchMetadata };
