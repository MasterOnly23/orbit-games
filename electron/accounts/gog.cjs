const { ProviderError } = require("./provider-error.cjs");

async function requestJson(fetchImpl, url, signal) {
  try {
    const response = await fetchImpl(url, {
      credentials: "include",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    if ([401, 403].includes(response.status))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de GOG.",
      );
    if (response.status === 429)
      throw new ProviderError(
        "rate-limit",
        "GOG está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      throw new ProviderError(
        "unavailable",
        "GOG no está disponible. Se conserva tu biblioteca.",
      );
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new ProviderError(
          "invalid-response",
          "La respuesta de GOG supera el tamaño permitido.",
        );
      }
      chunks.push(Buffer.from(chunk.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "network",
      "No se pudo consultar GOG. Revisa la conexión e inténtalo de nuevo.",
    );
  }
}

const gog = {
  id: "gog",
  name: "GOG",
  implementation: "community",
  version: "1",
  usesBrowserSession: true,
  sessionUrl: "https://www.gog.com/account/",
  sessionHosts: ["www.gog.com"],
  navigationHosts: [
    "www.gog.com",
    "login.gog.com",
    "auth.gog.com",
    "menu.gog.com",
  ],
  validSession: (value) =>
    /^\d+$/.test(value?.externalId || "") &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0,
  async readSession({ fetchImpl, signal }) {
    const info = await requestJson(
      fetchImpl,
      "https://menu.gog.com/v1/account/basic",
      signal,
    );
    // Whitelist identity fields; the response may also contain access tokens that Orbit does not need.
    return info.isLoggedIn
      ? { externalId: String(info.userId), displayName: info.username }
      : null;
  },
  async fetchLibrary(credentials, { fetchImpl, signal } = {}) {
    if (!gog.validSession(credentials) || !fetchImpl)
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de GOG.",
      );
    const games = [],
      seen = new Set();
    let pages = null,
      total = null;
    for (let page = 1; page <= (pages ?? 1); page++) {
      const data = await requestJson(
        fetchImpl,
        `https://www.gog.com/u/${encodeURIComponent(credentials.displayName)}/games/stats?sort=recent_playtime&order=desc&page=${page}`,
        signal,
      );
      if (
        !Number.isInteger(data.pages) ||
        data.pages < 0 ||
        data.pages > 500 ||
        !Number.isInteger(data.total) ||
        data.total < 0 ||
        data.page !== page ||
        !Array.isArray(data._embedded?.items)
      )
        throw new ProviderError(
          "invalid-response",
          "GOG no devolvió una biblioteca legible. Se conserva la anterior.",
        );
      if (pages !== null && (data.pages !== pages || data.total !== total))
        throw new ProviderError(
          "incomplete",
          "La biblioteca de GOG cambió durante la consulta. Vuelve a sincronizar.",
        );
      pages = data.pages;
      total = data.total;
      for (const item of data._embedded.items) {
        const productId = String(item.game?.id || ""),
          name = item.game?.title;
        if (
          !/^\d+$/.test(productId) ||
          typeof name !== "string" ||
          !name.trim() ||
          seen.has(productId)
        )
          throw new ProviderError(
            "incomplete",
            "GOG devolvió juegos repetidos o incompletos. Se conserva tu biblioteca.",
          );
        seen.add(productId);
        games.push({ productId, name: name.trim(), access: "unknown" });
      }
    }
    if (games.length !== total)
      throw new ProviderError(
        "incomplete",
        "No se recibieron todos los juegos de GOG. Se conserva tu biblioteca.",
      );
    return { complete: true, games };
  },
};
module.exports = { gog };
