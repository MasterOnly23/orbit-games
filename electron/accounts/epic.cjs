const { ProviderError } = require("./provider-error.cjs");
const { fetchEpicCatalog } = require("./epic-catalog.cjs");

// Public launcher compatibility client used by the MIT Playnite integration.
// This is not a user's credential and grants no account access without authorization.
const compatibilityClient =
  "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";
const tokenUrl =
  "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";

function captureAuthorization(address) {
  try {
    const url = new URL(address);
    if (
      url.origin !== "http://localhost" ||
      url.pathname !== "/launcher/authorized"
    )
      return null;
    const code = url.searchParams.get("code");
    return /^[a-zA-Z0-9]{16,512}$/.test(code || "")
      ? { authorizationCode: code }
      : null;
  } catch {
    return null;
  }
}
async function epicRequest(url, options = {}, fetchImpl = fetch, signal) {
  try {
    const response = await fetchImpl(url, {
      ...options,
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    if ([400, 401, 403].includes(response.status))
      throw new ProviderError(
        "auth-required",
        "La autorización de Epic no es válida o ha vencido. Vuelve a conectar la cuenta.",
      );
    if (response.status === 429)
      throw new ProviderError(
        "rate-limit",
        "Epic está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      throw new ProviderError(
        "unavailable",
        "Epic no está disponible. Se conserva tu biblioteca.",
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
          "La respuesta de Epic supera el tamaño permitido.",
        );
      }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "network",
      "No se pudo consultar Epic. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
}
function credentialsFrom(response) {
  if (
    !/^[a-f0-9]{32}$/i.test(response?.account_id || "") ||
    typeof response.access_token !== "string" ||
    !response.access_token ||
    typeof response.refresh_token !== "string" ||
    !response.refresh_token ||
    !Number.isFinite(Date.parse(response.expires_at))
  )
    throw new ProviderError(
      "invalid-session",
      "Epic no devolvió una sesión utilizable.",
    );
  return {
    externalId: response.account_id,
    displayName: response.displayName || response.account_id,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: response.expires_at,
  };
}
const epic = {
  id: "epic",
  name: "Epic Games",
  implementation: "community",
  version: "1",
  sessionUrl: "https://www.epicgames.com/id/login?responseType=code",
  sessionHosts: ["www.epicgames.com"],
  navigationHosts: [
    "www.epicgames.com",
    "accounts.epicgames.com",
    "store.epicgames.com",
  ],
  userAgentSuffix: " EpicGamesLauncher",
  captureAuthorization,
  readSessionScript: `(() => {
    const match = document.documentElement.innerHTML.match(/localhost\\/launcher\\/authorized\\?code=([a-zA-Z0-9]{16,512})/);
    return match ? { authorizationCode: match[1] } : null;
  })()`,
  validSession: (value) =>
    /^[a-zA-Z0-9]{16,512}$/.test(value?.authorizationCode || ""),
  async connectSession({
    interactive,
    id,
    vault,
    readAuth,
    fetchImpl = fetch,
    now = Date.now(),
    signal,
  }) {
    let previous = null,
      grant;
    if (interactive) {
      const authorization = await readAuth();
      if (!epic.validSession(authorization))
        throw new ProviderError(
          "auth-required",
          "Epic no completó la autorización.",
        );
      grant = {
        grant_type: "authorization_code",
        code: authorization.authorizationCode,
      };
    } else {
      previous = await vault.read(id);
      if (!previous?.refreshToken)
        throw new ProviderError(
          "auth-required",
          "Vuelve a conectar tu cuenta de Epic.",
        );
      if (Date.parse(previous.expiresAt) > now + 120000) return previous;
      grant = {
        grant_type: "refresh_token",
        refresh_token: previous.refreshToken,
      };
    }
    const response = await epicRequest(
      tokenUrl,
      {
        method: "POST",
        headers: {
          Authorization: `basic ${compatibilityClient}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ ...grant, token_type: "eg1" }).toString(),
      },
      fetchImpl,
      signal,
    );
    const credentials = credentialsFrom(response);
    if (previous && previous.externalId !== credentials.externalId)
      throw new ProviderError(
        "account-mismatch",
        "Epic devolvió una sesión de otra cuenta. Vuelve a conectarla.",
      );
    await vault.write(id, credentials);
    return credentials;
  },
  async fetchLibrary(credentials, { fetchImpl = fetch, signal } = {}) {
    if (!credentials?.accessToken)
      throw new ProviderError("auth-required", "Vuelve a conectar Epic.");
    return fetchEpicCatalog((url) =>
      epicRequest(
        url,
        { headers: { Authorization: `bearer ${credentials.accessToken}` } },
        fetchImpl,
        signal,
      ),
    );
  },
};
module.exports = { epic, captureAuthorization, credentialsFrom };
