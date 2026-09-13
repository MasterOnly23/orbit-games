// Used only with an Orbit-owned isolated Electron session. Never log request
// headers, return them to a renderer, or attach this to an existing app session.
const endpoint = "https://service-aggregation-layer.juno.ea.com/graphql";
const observedSessions = new WeakSet();

function authorizationFromRequest(details, webContentsId) {
  if (
    details.webContentsId !== webContentsId ||
    !Number.isSafeInteger(webContentsId) ||
    webContentsId <= 0
  )
    return null;
  try {
    const url = new URL(details.url);
    if (
      url.origin !== new URL(endpoint).origin ||
      url.pathname !== "/graphql" ||
      url.username ||
      url.password
    )
      return null;
  } catch {
    return null;
  }
  const headers = Object.entries(details.requestHeaders || {}).filter(
    ([key]) => key.toLowerCase() === "authorization",
  );
  if (headers.length !== 1 || typeof headers[0][1] !== "string") return null;
  const match = /^Bearer ([^\s]{1,16384})$/i.exec(headers[0][1]);
  return match?.[1] || null;
}

function observeEaAuthorization({ webRequest, webContentsId, signal }) {
  if (observedSessions.has(webRequest))
    throw new Error("Ya hay una autenticación EA activa en esta sesión.");
  let token = null;
  let disposed = false;
  const listener = (details, callback) => {
    // Always release the original browser request, including after cancellation.
    try {
      if (!disposed) {
        const captured = authorizationFromRequest(details, webContentsId);
        if (captured) token = captured;
      }
    } finally {
      callback({});
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    token = null;
    signal?.removeEventListener("abort", dispose);
    webRequest.onBeforeSendHeaders({ urls: [`${endpoint}*`] }, null);
    observedSessions.delete(webRequest);
  };
  if (signal?.aborted) disposed = true;
  else {
    webRequest.onBeforeSendHeaders({ urls: [`${endpoint}*`] }, listener);
    observedSessions.add(webRequest);
    signal?.addEventListener("abort", dispose, { once: true });
  }
  return {
    // A captured bearer is only transport material, not proof of account identity.
    // The caller must validate EA's account/catalog response before connecting.
    read: () => token,
    dispose,
  };
}

module.exports = { authorizationFromRequest, observeEaAuthorization };
