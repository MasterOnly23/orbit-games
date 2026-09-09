const { ProviderError } = require("./provider-error.cjs");
const appId = "f68a4bb5-608a-4ff2-8123-be8ef797e0a6";
const query = `query GetOwnedGames($spaceIds: [String!]) { games(spaceIds: $spaceIds) { id spaceId name platform { type } availablePlatformGroups { type } availablePlatforms { nodes { type } } viewer { meta { ownedCrossplayPlatforms { nodes { type } } } } } }`;
async function request(
  url,
  credentials,
  { fetchImpl = fetch, signal, method = "GET", body, authorization } = {},
) {
  try {
    const response = await fetchImpl(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      headers: {
        Authorization: authorization || `Ubi_v1 t=${credentials.ticket}`,
        "Ubi-AppId": appId,
        "Ubi-SessionId": credentials.sessionId,
        "Ubi-LocaleCode": "en-US",
        "Content-Type": "application/json",
        Origin: "https://connect.ubisoft.com",
      },
    });
    if ([401, 403].includes(response.status))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar Ubisoft Connect.",
      );
    if (response.status === 429)
      throw new ProviderError(
        "rate-limit",
        "Ubisoft está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      throw new ProviderError(
        "unavailable",
        "Ubisoft no está disponible. Se conserva tu biblioteca.",
      );
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 12 * 1024 * 1024) {
        await reader.cancel();
        throw new ProviderError(
          "invalid-response",
          "La respuesta de Ubisoft supera el tamaño permitido.",
        );
      }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "network",
      "No se pudo consultar Ubisoft. Revisa la conexión e inténtalo de nuevo.",
    );
  }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const valid = (value) =>
  uuid.test(value?.externalId || "") &&
  typeof value.ticket === "string" &&
  value.ticket.length > 0 &&
  typeof value.sessionId === "string" &&
  value.sessionId.length > 0;
const hasPc = (game) =>
  [
    game.platform,
    ...(game.availablePlatformGroups || []),
    ...(game.availablePlatforms?.nodes || []),
    ...(game.viewer?.meta?.ownedCrossplayPlatforms?.nodes || []),
  ].some((platform) => platform?.type === "PC");
const ubisoft = {
  id: "ubisoft",
  name: "Ubisoft",
  implementation: "community",
  version: "1",
  sessionUrl: `https://connect.ubisoft.com/login?appId=${appId}&genomeId=954e66a0-be1b-4aa0-9690-fb75201e4e9e&lang=en-US&nextUrl=https:%2F%2Fconnect.ubisoft.com%2F`,
  sessionHosts: ["connect.ubisoft.com"],
  navigationHosts: [
    "connect.ubisoft.com",
    "account.ubisoft.com",
    "www.ubisoft.com",
  ],
  readSessionScript: `(() => { try {
    const value = JSON.parse(window.localStorage.getItem('PRODloginData') || 'null');
    if (!value?.ticket || !value.userId || !value.sessionId) return null;
    const remembered = JSON.parse(window.localStorage.getItem('PRODrememberMe') || 'null');
    return { externalId: value.userId, displayName: value.nameOnPlatform || value.userId, ticket: value.ticket, sessionId: value.sessionId, rememberMeTicket: remembered?.rememberMeTicket || value.rememberMeTicket || null, expiration: value.expiration || null };
  } catch { return null; } })()`,
  validSession: valid,
  async connectSession({
    interactive,
    id,
    vault,
    readAuth,
    signal,
    fetchImpl = fetch,
  }) {
    const previous = interactive ? await readAuth() : await vault.read(id);
    if (!valid(previous))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar Ubisoft Connect.",
      );
    let refreshed;
    try {
      refreshed = await request(
        "https://public-ubiservices.ubi.com/v3/profiles/sessions",
        previous,
        { method: "PUT", signal, fetchImpl },
      );
    } catch (error) {
      if (
        signal?.aborted ||
        error.code !== "auth-required" ||
        !previous.rememberMeTicket
      )
        throw error;
      refreshed = await request(
        "https://public-ubiservices.ubi.com/v3/profiles/sessions",
        previous,
        {
          method: "POST",
          signal,
          fetchImpl,
          authorization: `rm_v1 t=${previous.rememberMeTicket}`,
          body: { rememberMe: true },
        },
      );
    }
    const credentials = {
      externalId: refreshed.userId,
      displayName:
        refreshed.nameOnPlatform || refreshed.username || previous.displayName,
      ticket: refreshed.ticket,
      sessionId: refreshed.sessionId,
      expiration: refreshed.expiration,
      rememberMeTicket:
        refreshed.rememberMeTicket || previous.rememberMeTicket || null,
    };
    if (!valid(credentials) || credentials.externalId !== previous.externalId)
      throw new ProviderError(
        "account-mismatch",
        "Ubisoft no devolvió una sesión de la misma cuenta. Vuelve a conectarla.",
      );
    await vault.write(id, credentials);
    return credentials;
  },
  async fetchLibrary(credentials, options = {}) {
    const data = await request(
      "https://api-ubiservices.ubi.com/v1/profiles/me/global/ubiconnect/entitlement/api/entitlements",
      credentials,
      options,
    );
    const entries = Array.isArray(data.entitlements)
      ? data.entitlements
      : data.entitlements?.nodes;
    if (
      !Array.isArray(entries) ||
      data.nextCursor ||
      data.entitlements?.pageInfo?.hasNextPage
    )
      throw new ProviderError(
        "incomplete",
        "Ubisoft no devolvió una lista completa de accesos.",
      );
    const owned = entries.filter(
      (item) =>
        item.accessLevel?.toLowerCase() === "owned" &&
        item.type?.toLowerCase() === "game" &&
        !["expired", "revoked"].includes(item.availability?.toLowerCase()),
    );
    if (owned.some((item) => !uuid.test(item.spaceId || "")))
      throw new ProviderError(
        "incomplete",
        "Hay juegos de Ubisoft sin una ficha identificable. Se conserva la biblioteca anterior.",
      );
    const spaces = [...new Set(owned.map((item) => item.spaceId))],
      games = [],
      seen = new Set();
    for (let offset = 0; offset < spaces.length; offset += 40) {
      const batch = spaces.slice(offset, offset + 40);
      const response = await request(
        "https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql",
        credentials,
        {
          ...options,
          method: "POST",
          body: {
            operationName: "GetOwnedGames",
            query,
            variables: { spaceIds: batch },
          },
        },
      );
      if (
        response.errors?.length ||
        !Array.isArray(response.data?.games) ||
        batch.some(
          (id) =>
            !response.data.games.some(
              (game) => (game.spaceId || game.id) === id,
            ),
        )
      )
        throw new ProviderError(
          "incomplete",
          "Faltan fichas de Ubisoft. Se conserva la biblioteca anterior.",
        );
      for (const game of response.data.games) {
        if (!hasPc(game)) continue;
        const spaceId = game.spaceId || game.id;
        if (typeof game.name !== "string" || !game.name.trim())
          throw new ProviderError(
            "incomplete",
            "Ubisoft devolvió una ficha sin título.",
          );
        for (const entitlement of owned.filter(
          (entry) => entry.spaceId === spaceId,
        )) {
          const productId = String(entitlement.productId || `space:${spaceId}`);
          if (seen.has(productId)) continue;
          seen.add(productId);
          games.push({
            productId,
            name: game.name.trim(),
            access: "owned",
            accessNote:
              "Acceso reportado por Ubisoft; edición para PC por verificar",
            launch: /^\d+$/.test(productId)
              ? { kind: "uri", target: `uplay://launch/${productId}` }
              : null,
          });
        }
      }
    }
    return { complete: true, games };
  },
};
module.exports = { ubisoft };
