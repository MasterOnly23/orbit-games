const { ProviderError } = require("./provider-error.cjs");

function parseSteamLibrary(payload) {
  const response = payload?.response;
  if (
    !response ||
    !Number.isInteger(response.game_count) ||
    response.game_count < 0
  )
    throw new ProviderError(
      "library-unavailable",
      "Steam no devolvió una biblioteca legible. Vuelve a conectar la cuenta y revisa su privacidad.",
    );
  const games = response.games || (response.game_count === 0 ? [] : null);
  if (!Array.isArray(games) || games.length !== response.game_count)
    throw new ProviderError(
      "incomplete",
      "La respuesta de Steam está incompleta. Se conserva la biblioteca anterior.",
    );
  const seen = new Set();
  const mapped = games.map((game) => {
    const productId = String(game.appid || "");
    if (!/^\d+$/.test(productId) || seen.has(productId))
      throw new ProviderError(
        "invalid-response",
        "Steam devolvió identificadores de juegos no válidos.",
      );
    seen.add(productId);
    return {
      productId,
      name:
        typeof game.name === "string" && game.name.trim()
          ? game.name.trim()
          : `Juego de Steam ${productId}`,
      access: "unknown",
      playtimeMinutes: game.playtime_forever,
      launch: { kind: "uri", target: `steam://rungameid/${productId}` },
    };
  });
  return { complete: true, games: mapped };
}

const steam = {
  id: "steam",
  name: "Steam",
  implementation: "community",
  version: "1",
  sessionUrl: "https://store.steampowered.com/explore/",
  sessionHosts: ["store.steampowered.com"],
  navigationHosts: [
    "store.steampowered.com",
    "login.steampowered.com",
    "help.steampowered.com",
    "steamcommunity.com",
  ],
  readSessionScript: `(() => {
    const node = document.getElementById('application_config');
    if (!node) return null;
    try {
      const user = JSON.parse(node.getAttribute('data-userinfo') || 'null');
      const config = JSON.parse(node.getAttribute('data-store_user_config') || 'null');
      if (!user?.logged_in || !config?.webapi_token) return null;
      return { externalId: String(user.steamid), displayName: user.personaname || user.account_name || String(user.steamid), accessToken: config.webapi_token };
    } catch { return null; }
  })()`,
  validSession: (value) =>
    /^\d{17}$/.test(value?.externalId || "") &&
    typeof value.accessToken === "string" &&
    value.accessToken.length >= 20 &&
    value.accessToken.length < 16384,
  async fetchLibrary(credentials, { signal, fetchImpl = fetch } = {}) {
    if (!steam.validSession(credentials))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de Steam.",
      );
    const url = new URL(
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
    );
    url.search = new URLSearchParams({
      steamid: credentials.externalId,
      access_token: credentials.accessToken,
      include_appinfo: "true",
      include_played_free_games: "true",
      include_free_sub: "true",
      format: "json",
    }).toString();
    try {
      const response = await fetchImpl(url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
        redirect: "error",
      });
      if ([401, 403].includes(response.status))
        throw new ProviderError(
          "auth-required",
          "La sesión de Steam ya no permite consultar la biblioteca. Vuelve a conectar la cuenta.",
        );
      if (response.status === 429)
        throw new ProviderError(
          "rate-limit",
          "Steam está limitando las consultas. Espera unos minutos antes de sincronizar.",
        );
      if (!response.ok)
        throw new ProviderError(
          "unavailable",
          "Steam no está disponible. Tu biblioteca guardada se conserva.",
        );
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 12 * 1024 * 1024) {
          await reader.cancel();
          throw new ProviderError(
            "invalid-response",
            "La respuesta de Steam supera el tamaño esperado.",
          );
        }
        chunks.push(Buffer.from(part.value));
      }
      return parseSteamLibrary(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      // Never propagate fetch errors: they can contain URLs carrying session tokens.
      throw new ProviderError(
        signal?.aborted ? "cancelled" : "network",
        signal?.aborted
          ? "Sincronización cancelada."
          : "No se pudo consultar Steam. Revisa tu conexión y vuelve a intentarlo.",
      );
    }
  },
};
module.exports = { steam, parseSteamLibrary };
