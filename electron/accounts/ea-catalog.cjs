const { ProviderError } = require("./provider-error.cjs");
const { abortable } = require("../library/abortable.cjs");

function invalid() {
  throw new ProviderError(
    "incomplete",
    "EA no devolvió una biblioteca completa y verificable. Se conserva la anterior.",
  );
}
const identifier = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);

function parseEaPage(response) {
  if (
    response?.errors !== undefined &&
    (!Array.isArray(response.errors) || response.errors.length)
  )
    invalid();
  const me = response?.data?.me;
  const page = me?.ownedGameProducts;
  if (
    !identifier(me?.id) ||
    !Array.isArray(page?.items) ||
    page.items.length > 500 ||
    !Number.isSafeInteger(page.totalCount) ||
    page.totalCount < 0 ||
    page.totalCount > 10000 ||
    !(
      page.next === null ||
      (typeof page.next === "string" &&
        page.next.length > 0 &&
        page.next.length <= 2048)
    )
  )
    invalid();
  const games = [];
  const recordIds = [];
  for (const entry of page.items) {
    const product = entry?.product;
    if (
      !identifier(entry?.id) ||
      !identifier(entry.originOfferId) ||
      !identifier(product?.id) ||
      typeof product.name !== "string" ||
      !product.name.trim() ||
      product.name.length > 500 ||
      typeof product.gamePlatformDetails?.gamePlatform !== "string" ||
      typeof product.baseItem?.isLauncher !== "boolean"
    )
      invalid();
    recordIds.push(entry.id);
    if (
      product.baseItem.isLauncher ||
      !product.gamePlatformDetails.gamePlatform.split("_").includes("PC")
    )
      continue;
    const methods = product.gameProductUser?.ownershipMethods;
    if (
      !Array.isArray(methods) ||
      methods.length > 30 ||
      methods.some((method) => typeof method !== "string" || method.length > 80)
    )
      invalid();
    const subscription = methods.some((method) =>
      [
        "VAULT",
        "XGP_VAULT",
        "STEAM_VAULT",
        "STEAM_SUBSCRIPTION",
        "EPIC_VAULT",
        "EPIC_SUBSCRIPTION",
      ].includes(method),
    );
    games.push({
      productId: entry.originOfferId,
      name: product.name.trim(),
      access: "unknown",
      accessNote:
        product.isUngatedTrial === true
          ? "EA identifica una prueba; disponibilidad y duración vigentes sin verificar."
          : subscription
            ? "EA registra acceso por suscripción; vigencia y compra permanente sin verificar."
            : "Juego registrado en EA; compra y acceso vigente sin verificar.",
    });
  }
  return {
    accountId: me.id,
    next: page.next,
    total: page.totalCount,
    recordIds,
    games,
  };
}

// requestPage owns transport and authentication; no tokens or raw responses leave here.
async function readEaCatalog(requestPage, { signal } = {}) {
  const cursors = new Set(),
    records = new Set(),
    products = new Set();
  const games = [];
  let next = "0",
    accountId,
    total;
  for (let index = 0; index < 100; index++) {
    signal?.throwIfAborted();
    if (cursors.has(next)) invalid();
    cursors.add(next);
    const page = parseEaPage(
      await abortable(() => requestPage(next, { signal }), signal),
    );
    if (index === 0) {
      accountId = page.accountId;
      total = page.total;
    }
    if (page.accountId !== accountId || page.total !== total) invalid();
    for (const id of page.recordIds) {
      if (records.has(id)) invalid();
      records.add(id);
    }
    for (const game of page.games) {
      if (products.has(game.productId)) invalid();
      products.add(game.productId);
      games.push(game);
    }
    if (records.size > total) invalid();
    if (page.next === null) {
      if (records.size !== total) invalid();
      signal?.throwIfAborted();
      return { externalId: accountId, games };
    }
    if (!page.recordIds.length) invalid();
    next = page.next;
  }
  invalid();
}

module.exports = { parseEaPage, readEaCatalog };
