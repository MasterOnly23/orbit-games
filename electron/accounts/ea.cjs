const { observeEaAuthorization } = require("./ea-authorization.cjs");
const { fetchEaCatalog } = require("./ea-transport.cjs");
const { ProviderError } = require("./provider-error.cjs");

const dealsUrl = "https://www.ea.com/sales/deals";
const ea = {
  id: "ea",
  name: "EA app",
  version: "1",
  implementation: "community",
  sessionUrl: "https://www.ea.com/login",
  sessionHosts: ["www.ea.com"],
  navigationHosts: ["www.ea.com", "signin.ea.com", "accounts.ea.com"],
  prepareSession({ isolated, webContents, signal }) {
    const capture = observeEaAuthorization({
      webRequest: isolated.webRequest,
      webContentsId: webContents.id,
      signal,
    });
    let movedToDeals = false;
    return {
      dispose: capture.dispose,
      waitForSession: true,
      propagateErrors: true,
      async readSession() {
        const token = capture.read();
        if (!token) {
          const current = new URL(webContents.getURL());
          // After the official login returns home, load a page that requests
          // the authenticated EA GraphQL service. Never inject credentials.
          if (
            !movedToDeals &&
            current.origin === "https://www.ea.com" &&
            /^\/(?:[a-z]{2}(?:-[a-z]{2})?)?\/?$/i.test(current.pathname)
          ) {
            movedToDeals = true;
            await webContents.loadURL(dealsUrl);
          }
          return null;
        }
        const catalog = await fetchEaCatalog({
          fetchImpl: isolated.fetch.bind(isolated),
          token,
          signal,
        });
        // The bearer remains local to this request; only validated catalog data
        // crosses back to the account service, which persists its allowlist.
        return {
          externalId: catalog.externalId,
          displayName: "Cuenta EA",
          catalog,
        };
      },
    };
  },
  validSession: (value) =>
    typeof value?.externalId === "string" &&
    value.externalId.length > 0 &&
    value.catalog?.externalId === value.externalId &&
    Array.isArray(value.catalog?.games),
  async fetchLibrary(credentials, { signal } = {}) {
    signal?.throwIfAborted();
    if (!ea.validSession(credentials))
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar tu cuenta de EA.",
      );
    return { complete: true, games: credentials.catalog.games };
  },
};
module.exports = { ea };
