const { ProviderError } = require("./provider-error.cjs");
const { abortable } = require("../library/abortable.cjs");

function invalid() {
  throw new ProviderError(
    "incomplete",
    "Battle.net no devolvió una biblioteca verificable. Se conserva la anterior.",
  );
}

function parseGameAccounts(data) {
  if (!Array.isArray(data?.gameAccounts) || data.gameAccounts.length > 10000)
    invalid();
  const games = new Map();
  for (const entry of data.gameAccounts) {
    if (
      !Number.isSafeInteger(entry?.titleId) ||
      entry.titleId <= 0 ||
      typeof entry.localizedGameName !== "string" ||
      !entry.localizedGameName.trim() ||
      entry.localizedGameName.length > 500
    )
      invalid();
    const productId = `title:${entry.titleId}`;
    const name = entry.localizedGameName.trim();
    const existing = games.get(productId);
    if (existing && existing.name !== name) invalid();
    // Multiple game accounts/regions are not separate purchases. No account names,
    // region IDs, subscription details or raw statuses cross this boundary.
    games.set(productId, {
      productId,
      name,
      access: "unknown",
      accessNote:
        "Registro de juego de Battle.net; compra y acceso vigente no verificados.",
    });
  }
  return [...games.values()];
}

async function requestCatalog(fetchImpl, url, signal) {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000);
  try {
    const response = await abortable(
      () =>
        fetchImpl(url, {
          credentials: "include",
          redirect: "error",
          signal: requestSignal,
        }),
      requestSignal,
    );
    if ([401, 403].includes(response.status))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de Battle.net.",
      );
    if (response.status === 429)
      throw new ProviderError(
        "rate-limit",
        "Battle.net está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      throw new ProviderError(
        "unavailable",
        "Battle.net no está disponible. Se conserva tu biblioteca.",
      );
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await abortable(() => reader.read(), requestSignal);
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 8 * 1024 * 1024) invalid();
        chunks.push(Buffer.from(chunk.value));
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (signal?.aborted)
      throw new ProviderError(
        "cancelled",
        "Consulta cancelada. Se conserva tu biblioteca.",
      );
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "network",
      "No se pudo leer Battle.net. Revisa la conexión y vuelve a intentarlo.",
    );
  }
}

async function fetchBattleNetCatalog({ fetchImpl, signal }) {
  const accounts = await requestCatalog(
    fetchImpl,
    "https://account.battle.net/api/games-and-subs",
    signal,
  );
  const games = parseGameAccounts(accounts);
  const classic = await requestCatalog(
    fetchImpl,
    "https://account.battle.net/api/classic-games",
    signal,
  );
  if (!Array.isArray(classic?.classicGames)) invalid();
  // Never silently call a partial library complete, nor retain product keys.
  // A verified classic-edition identity mapping is required before importing it.
  if (classic.classicGames.length)
    throw new ProviderError(
      "unsupported-catalog",
      "Esta cuenta incluye juegos clásicos que Orbit aún no puede identificar con fiabilidad. Se conserva la biblioteca anterior.",
    );
  signal?.throwIfAborted();
  return { complete: true, games };
}
async function readBattleNetSession({ fetchImpl, signal }) {
  try {
    const data = await requestCatalog(
      fetchImpl,
      "https://account.battle.net/api/",
      signal,
    );
    return data?.authenticated === true
      ? { authenticated: true, displayName: "Sesión Battle.net" }
      : null;
  } catch (error) {
    if (error.code === "auth-required") return null;
    throw error;
  }
}
module.exports = {
  parseGameAccounts,
  fetchBattleNetCatalog,
  readBattleNetSession,
};
