const { idFor } = require("./model.cjs");
const { withEaOfferIdentity } = require("./ea-identity.cjs");

// Remote access is independent of local installation evidence and user edits.
function mergeAccountLibrary(
  previous,
  account,
  snapshot,
  at = new Date().toISOString(),
) {
  if (
    !account?.id ||
    !account?.provider ||
    !Array.isArray(snapshot?.games) ||
    snapshot.complete !== true
  )
    throw new Error(
      "La sincronización no devolvió una biblioteca completa. Se conserva la última copia.",
    );
  const products = new Set();
  for (const game of snapshot.games) {
    if (
      !game ||
      typeof game.productId !== "string" ||
      !game.productId ||
      typeof game.name !== "string" ||
      !game.name.trim() ||
      products.has(game.productId)
    )
      throw new Error(
        "La plataforma devolvió juegos no válidos o duplicados. Se conserva la última copia.",
      );
    products.add(game.productId);
  }
  const mapped =
    account.provider === "EA app"
      ? withEaOfferIdentity(previous, [
          // A fresh snapshot replaces mappings for its offers, including removals.
          ...previous.filter(
            (game) =>
              !(
                game.provider === account.provider &&
                products.has(game.providerId)
              ),
          ),
          ...snapshot.games.map((game) => ({
            provider: account.provider,
            providerId: game.productId,
            eaContentId: game.eaContentId,
          })),
        ])
      : previous;
  const result = mapped.map((game) => ({
    ...game,
    accountEntitlements: (game.accountEntitlements || []).map((access) =>
      access.accountId === account.id
        ? { ...access, state: "not-seen", checkedAt: at }
        : { ...access },
    ),
  }));
  for (const item of snapshot.games) {
    let game = result.find(
      (g) =>
        g.provider === account.provider &&
        (String(g.providerId || g.steamId || "") === item.productId ||
          g.accountEntitlements?.some(
            (access) =>
              access.accountId === account.id &&
              access.productId === item.productId,
          )),
    );
    if (!game) {
      game = {
        id: idFor(`${account.provider.toLowerCase()}:${item.productId}`),
        provider: account.provider,
        providerId: item.productId,
        name: item.name,
        steamId: account.provider === "Steam" ? item.productId : undefined,
        launch: item.launch || null,
        sources: [],
        remoteOnly: true,
        status: "uninstalled",
        statusReason: "En tu cuenta. No se ha detectado una instalación local.",
        favorite: false,
        hidden: false,
        notes: "",
        customName: "",
        statusOverride: "auto",
        addedAt: at,
        accountEntitlements: [],
      };
      result.push(game);
    }
    const access = {
      accountId: account.id,
      productId: item.productId,
      kind: ["owned", "free", "subscription", "shared"].includes(item.access)
        ? item.access
        : "unknown",
      state: "available",
      checkedAt: at,
    };
    if (account.provider === "EA app") {
      if (typeof item.eaContentId === "string")
        game.eaContentId = item.eaContentId;
      else delete game.eaContentId;
    }
    if (typeof item.accessNote === "string")
      game.accountAccessNote = item.accessNote.slice(0, 200);
    game.accountEntitlements = [
      ...game.accountEntitlements.filter((a) => a.accountId !== account.id),
      access,
    ];
    if (Number.isFinite(item.playtimeMinutes) && item.playtimeMinutes >= 0)
      game.platformPlaytimeMinutes = item.playtimeMinutes;
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function disconnectAccountLibrary(games, accountId) {
  return games.map((game) => ({
    ...game,
    accountEntitlements: (game.accountEntitlements || []).map((access) =>
      access.accountId === accountId
        ? { ...access, state: "disconnected" }
        : access,
    ),
  }));
}

module.exports = { mergeAccountLibrary, disconnectAccountLibrary };
