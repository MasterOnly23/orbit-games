const { randomBytes, createHash } = require("node:crypto");
const { ProviderError } = require("./provider-error.cjs");
const redirectUri = "http://127.0.0.1:43817/orbit/itch/callback";
const tokenValid = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= 8192 &&
  !/[\s\x00]/.test(value);
const fail = (code, message) => {
  throw new ProviderError(code, message);
};
async function request(
  endpoint,
  accessToken,
  { fetchImpl = fetch, signal, form } = {},
) {
  try {
    const response = await fetchImpl(`https://api.itch.io${endpoint}`, {
      method: form ? "POST" : "GET",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(form
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
        Accept: "application/json",
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    if ([401, 403].includes(response.status))
      fail(
        "auth-required",
        "Vuelve a conectar itch.io y concede acceso a tu biblioteca.",
      );
    if (response.status === 429)
      fail(
        "rate-limit",
        "itch.io está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      fail(
        "unavailable",
        "itch.io no está disponible. Se conserva tu biblioteca.",
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
        fail(
          "invalid-response",
          "La respuesta de itch.io supera el tamaño permitido.",
        );
      }
      chunks.push(Buffer.from(part.value));
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || value.errors?.length)
      fail(
        "invalid-response",
        "itch.io no pudo completar la consulta. Se conserva tu biblioteca.",
      );
    return value;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    fail(
      "network",
      "No se pudo consultar itch.io. Revisa la conexión e inténtalo de nuevo.",
    );
  }
}
function authorization(clientId) {
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "profile:me profile:owned",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return {
    verifier,
    provider: {
      name: "itch.io",
      sessionUrl: `https://itch.io/user/oauth?${params}`,
      sessionHosts: [],
      navigationHosts: ["itch.io"],
      captureAuthorization(value) {
        try {
          const url = new URL(value),
            expected = new URL(redirectUri);
          if (
            url.origin !== expected.origin ||
            url.pathname !== expected.pathname ||
            url.username ||
            url.password ||
            url.hash ||
            url.searchParams.getAll("state").length !== 1 ||
            url.searchParams.get("state") !== state ||
            url.searchParams.getAll("code").length !== 1
          )
            return null;
          const code = url.searchParams.get("code");
          return tokenValid(code) ? { code } : null;
        } catch {
          return null;
        }
      },
    },
  };
}
function createItchProvider(clientId) {
  if (typeof clientId !== "string" || !/^[a-zA-Z0-9_-]{8,256}$/.test(clientId))
    return null;
  return {
    id: "itch",
    name: "itch.io",
    implementation: "official-api",
    version: "1",
    async connectSession({
      interactive,
      id,
      vault,
      readAuth,
      signal,
      fetchImpl = fetch,
    }) {
      let credentials;
      if (interactive) {
        const auth = authorization(clientId);
        const result = await readAuth(auth.provider);
        const token = await request("/oauth/token", null, {
          fetchImpl,
          signal,
          form: {
            grant_type: "authorization_code",
            client_id: clientId,
            redirect_uri: redirectUri,
            code: result.code,
            code_verifier: auth.verifier,
          },
        });
        credentials = credentialsFrom(token);
      } else {
        credentials = await vault.read(id);
        if (
          !tokenValid(credentials?.accessToken) ||
          !Number.isFinite(credentials?.expiresAt) ||
          !/^\d+$/.test(credentials?.externalId || "")
        )
          fail("auth-required", "Vuelve a conectar itch.io.");
        if (credentials.expiresAt <= Date.now() + 120000) {
          if (!tokenValid(credentials.refreshToken))
            fail(
              "auth-required",
              "La sesión de itch.io venció. Vuelve a conectarla.",
            );
          const token = await request("/oauth/token", null, {
            fetchImpl,
            signal,
            form: {
              grant_type: "refresh_token",
              client_id: clientId,
              refresh_token: credentials.refreshToken,
            },
          });
          credentials = {
            ...credentials,
            ...credentialsFrom(token, credentials.refreshToken),
          };
          // Rotation can invalidate the old refresh token immediately. Retain it
          // even if the following profile request fails; catalog import still
          // requires the expected identity to be verified below.
          await vault.write(id, credentials);
        }
      }
      const profile = await request("/profile", credentials.accessToken, {
        fetchImpl,
        signal,
      });
      if (!Number.isSafeInteger(profile.user?.id) || profile.user.id <= 0)
        fail("invalid-response", "itch.io no devolvió una identidad válida.");
      const externalId = String(profile.user.id);
      if (credentials.externalId && credentials.externalId !== externalId)
        fail(
          "account-mismatch",
          "La sesión de itch.io pertenece a otra cuenta. Vuelve a conectarla.",
        );
      const result = {
        ...credentials,
        externalId,
        displayName: String(
          profile.user.display_name || profile.user.username || externalId,
        ).slice(0, 200),
      };
      if (signal?.aborted) fail("cancelled", "Conexión cancelada.");
      await vault.write(id, result);
      return result;
    },
    fetchLibrary,
  };
}
function credentialsFrom(token, previousRefresh) {
  if (
    !tokenValid(token.access_token) ||
    !Number.isSafeInteger(token.expires_in) ||
    token.expires_in <= 0 ||
    token.expires_in > 31536000
  )
    fail("invalid-response", "itch.io no devolvió una autorización válida.");
  const refreshToken = token.refresh_token || previousRefresh;
  if (!tokenValid(refreshToken))
    fail("invalid-response", "itch.io no devolvió una sesión renovable.");
  return {
    accessToken: token.access_token,
    refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
}
async function fetchLibrary(credentials, options = {}) {
  const games = new Map(),
    seenKeys = new Set();
  let perPage;
  for (let page = 1; page <= 500; page++) {
    const data = await request(
      `/profile/owned-keys?page=${page}`,
      credentials.accessToken,
      options,
    );
    if (
      !Array.isArray(data.owned_keys) ||
      data.page !== page ||
      !Number.isSafeInteger(data.per_page) ||
      data.per_page < 1 ||
      data.per_page > 1000 ||
      (perPage && perPage !== data.per_page) ||
      data.owned_keys.length > data.per_page
    )
      fail(
        "incomplete",
        "itch.io devolvió una biblioteca incompleta. Se conserva la anterior.",
      );
    perPage = data.per_page;
    for (const item of data.owned_keys) {
      if (
        !Number.isSafeInteger(item?.id) ||
        item.id <= 0 ||
        seenKeys.has(item.id) ||
        !Number.isSafeInteger(item.game?.id) ||
        item.game.id <= 0 ||
        item.game_id !== item.game.id ||
        typeof item.game.title !== "string" ||
        !item.game.title.trim()
      )
        fail(
          "incomplete",
          "Faltan fichas o hay páginas repetidas en itch.io. Se conserva la biblioteca anterior.",
        );
      seenKeys.add(item.id);
      if (
        item.owner_id != null &&
        String(item.owner_id) !== credentials.externalId
      )
        fail("account-mismatch", "itch.io devolvió accesos de otra cuenta.");
      if (item.game.classification && item.game.classification !== "game")
        continue;
      const productId = String(item.game.id);
      games.set(productId, {
        productId,
        name: item.game.title.trim(),
        access: "owned",
        accessNote:
          "Comprado o reclamado en itch.io; compatibilidad con Windows por verificar",
        launch: null,
      });
    }
    if (data.owned_keys.length < perPage)
      return { complete: true, games: [...games.values()] };
  }
  fail(
    "incomplete",
    "La biblioteca de itch.io supera el límite de consulta. Se conserva la anterior.",
  );
}
module.exports = {
  createItchProvider,
  authorization,
  fetchLibrary,
  redirectUri,
};
