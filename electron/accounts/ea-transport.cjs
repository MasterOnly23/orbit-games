const { ProviderError } = require("./provider-error.cjs");
const { abortable } = require("../library/abortable.cjs");
const { readEaCatalog } = require("./ea-catalog.cjs");
const { readEaOfferMapping } = require("./ea-offers.cjs");

// Protocol reference pinned in EA_SUPPORT.md; not an official public EA API.
function catalogUrl(next) {
  if (typeof next !== "string" || !next.length || next.length > 2048)
    throw new ProviderError("incomplete", "El cursor de EA no es válido.");
  const variables = {
    isMac: false,
    addFieldsToPreloadGames: true,
    locale: "en",
    limit: 500,
    next,
    type: ["DIGITAL_FULL_GAME", "PACKAGED_FULL_GAME"],
    entitlementEnabled: true,
    storefronts: ["EA", "STEAM", "EPIC"],
    ownershipMethods: [
      "UNKNOWN",
      "ASSOCIATION",
      "PURCHASE",
      "REDEMPTION",
      "GIFT_RECEIPT",
      "ENTITLEMENT_GRANT",
      "DIRECT_ENTITLEMENT",
      "PRE_ORDER_PURCHASE",
      "VAULT",
      "XGP_VAULT",
      "STEAM",
      "STEAM_VAULT",
      "STEAM_SUBSCRIPTION",
      "EPIC",
      "EPIC_VAULT",
      "EPIC_SUBSCRIPTION",
    ],
    platforms: ["PC"],
  };
  const url = new URL("https://service-aggregation-layer.juno.ea.com/graphql");
  url.searchParams.set("operationName", "getPreloadedOwnedGames");
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set(
    "extensions",
    JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash:
          "779f1cd1355699752e20c0b3877847f4e3010ef5de131c248e98f8eff84f0718",
      },
    }),
  );
  return url.href;
}

async function requestEaJson({
  fetchImpl,
  url,
  body,
  token,
  signal,
  timeoutMs = 20000,
}) {
  if (
    token !== undefined &&
    (typeof token !== "string" ||
      !token.length ||
      token.length > 16384 ||
      /\s/.test(token))
  )
    throw new ProviderError(
      "auth-required",
      "Vuelve a conectar tu cuenta de EA.",
    );
  const timed = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timed]) : timed;
  let reader;
  try {
    const response = await abortable(
      () =>
        fetchImpl(url, {
          method: body ? "POST" : "GET",
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          headers: {
            ...(token !== undefined
              ? { Authorization: `Bearer ${token}` }
              : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
            Accept: "application/json",
          },
          signal: requestSignal,
        }),
      requestSignal,
    );
    reader = response.body?.getReader();
    if ([401, 403].includes(response.status))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de EA.",
      );
    if (response.status === 429)
      throw new ProviderError(
        "rate-limit",
        "EA está limitando las consultas. Inténtalo más tarde.",
      );
    if (!response.ok)
      throw new ProviderError(
        "unavailable",
        "EA no está disponible. Se conserva tu biblioteca.",
      );
    const chunks = [];
    let size = 0;
    while (true) {
      const chunk = await abortable(() => reader.read(), requestSignal);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8 * 1024 * 1024)
        throw new ProviderError(
          "incomplete",
          "La respuesta de EA supera el límite permitido.",
        );
      chunks.push(Buffer.from(chunk.value));
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
      "No se pudo leer EA. Revisa la conexión y vuelve a intentarlo.",
    );
  } finally {
    if (reader) reader.cancel().catch(() => {});
  }
}

async function requestEaPage(options) {
  return requestEaJson({
    ...options,
    token: options.token ?? "",
    url: catalogUrl(options.next),
  });
}

async function fetchEaOfferMapping({ offerIds, fetchImpl, signal }) {
  return readEaOfferMapping(
    offerIds,
    (batch) =>
      requestEaJson({
        fetchImpl,
        signal,
        url: "https://service-aggregation-layer.juno.ea.com/graphql",
        body: {
          operationName: "getLegacyCatalogDefs",
          query:
            "query getLegacyCatalogDefs($offerIds: [String!]!, $locale: Locale) { legacyOffers(offerIds: $offerIds, locale: $locale) { offerId: id contentId } }",
          variables: { offerIds: batch, locale: "DEFAULT" },
        },
      }),
    { signal },
  );
}

async function fetchEaCatalog({ fetchImpl, token, signal }) {
  return readEaCatalog(
    (next) => requestEaPage({ fetchImpl, token, next, signal }),
    { signal },
  );
}
module.exports = {
  catalogUrl,
  requestEaPage,
  fetchEaCatalog,
  fetchEaOfferMapping,
};
