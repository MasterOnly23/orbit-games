const { ProviderError } = require("./provider-error.cjs");

const supportedKeyTypes = new Set([
  "steam",
  "origin",
  "uplay",
  "gog",
  "epic",
  "battlenet",
]);
function parseOrders(orders, expected) {
  if (
    !orders ||
    typeof orders !== "object" ||
    expected.some((key) => !Object.hasOwn(orders, key) || !orders[key])
  )
    throw new ProviderError(
      "incomplete",
      "Humble no devolvió todos los pedidos. Se conserva tu biblioteca.",
    );
  const products = new Map();
  const add = (product, prefix) => {
    if (
      typeof product.machine_name !== "string" ||
      !product.machine_name ||
      typeof product.human_name !== "string" ||
      !product.human_name.trim()
    )
      throw new ProviderError(
        "incomplete",
        "Humble devolvió un producto sin identificar. Se conserva tu biblioteca.",
      );
    const productId = `${prefix}:${product.machine_name}`;
    products.set(productId, {
      productId,
      name: product.human_name.trim(),
      access: "unknown",
      accessNote:
        prefix === "download"
          ? "Descarga de Humble para Windows"
          : `Clave para ${product.key_type}: canje no verificado`,
    });
  };
  for (const key of expected) {
    const order = orders[key];
    if (
      !Array.isArray(order.subproducts) &&
      !Array.isArray(order.tpkd_dict?.all_tpks)
    )
      throw new ProviderError(
        "incomplete",
        "No se pudieron leer los productos de un pedido de Humble.",
      );
    for (const product of order.subproducts || [])
      if (
        product.downloads?.some((download) => download.platform === "windows")
      )
        add(product, "download");
    for (const product of order.tpkd_dict?.all_tpks || [])
      if (supportedKeyTypes.has(product.key_type))
        add(product, `key-${product.key_type}`);
  }
  return [...products.values()];
}
const humble = {
  id: "humble",
  name: "Humble Bundle",
  implementation: "community",
  version: "1",
  usesBrowserSession: true,
  sessionIdentity: true,
  sessionUrl: "https://www.humblebundle.com/home/library?hmb_source=navbar",
  sessionHosts: ["www.humblebundle.com"],
  navigationHosts: ["www.humblebundle.com", "humblebundle.com"],
  readSessionScript: `(() => {
    const node = document.querySelector('#user-home-json-data');
    if (!node) return null;
    try {
      const data = JSON.parse(node.textContent);
      return Array.isArray(data.gamekeys) ? { displayName: 'Biblioteca Humble', orderKeys: data.gamekeys } : null;
    } catch { return null; }
  })()`,
  validSession: (value) =>
    Array.isArray(value?.orderKeys) &&
    value.orderKeys.length <= 10000 &&
    value.orderKeys.every(
      (key) => typeof key === "string" && /^[a-zA-Z0-9_-]{1,256}$/.test(key),
    ),
  async fetchLibrary(credentials, { fetchImpl } = {}) {
    if (!humble.validSession(credentials) || !fetchImpl)
      throw new ProviderError(
        "auth-required",
        "Vuelve a conectar Humble Bundle.",
      );
    const keys = [...new Set(credentials.orderKeys)],
      products = new Map();
    for (let offset = 0; offset < keys.length; offset += 40) {
      const batch = keys.slice(offset, offset + 40),
        url = new URL(
          "https://www.humblebundle.com/api/v1/orders?all_tpkds=true",
        );
      batch.forEach((key) => url.searchParams.append("gamekeys", key));
      let orders;
      try {
        const response = await fetchImpl(url.href, {
          credentials: "include",
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        });
        if ([401, 403].includes(response.status))
          throw new ProviderError(
            "auth-required",
            "Vuelve a conectar Humble Bundle.",
          );
        if (response.status === 429)
          throw new ProviderError(
            "rate-limit",
            "Humble está limitando las consultas. Inténtalo más tarde.",
          );
        if (!response.ok)
          throw new ProviderError(
            "unavailable",
            "Humble no está disponible. Se conserva tu biblioteca.",
          );
        const reader = response.body.getReader(),
          chunks = [];
        let size = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 16 * 1024 * 1024) {
            await reader.cancel();
            throw new ProviderError(
              "invalid-response",
              "Un pedido de Humble supera el tamaño permitido.",
            );
          }
          chunks.push(Buffer.from(chunk.value));
        }
        orders = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        // Request URLs and order bodies can contain private redemption information.
        throw new ProviderError(
          "network",
          "No se pudo consultar Humble. Revisa la conexión e inténtalo de nuevo.",
        );
      }
      for (const game of parseOrders(orders, batch))
        products.set(game.productId, game);
    }
    return { complete: true, games: [...products.values()] };
  },
};
module.exports = { humble, parseOrders };
