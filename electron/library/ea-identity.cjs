function withEaOfferIdentity(games, known) {
  const offers = new Map();
  for (const game of known) {
    if (game.provider !== "EA app" || !game.providerId || !game.eaContentId)
      continue;
    const existing = offers.get(game.eaContentId);
    if (offers.has(game.eaContentId) && existing !== game.providerId)
      offers.set(game.eaContentId, null);
    else offers.set(game.eaContentId, game.providerId);
  }
  return games.map((game) => {
    if (
      game.provider !== "EA app" ||
      game.manual ||
      game.providerId ||
      !game.eaLaunchId
    )
      return game;
    const offerId = offers.get(game.eaLaunchId);
    return offerId
      ? { ...game, providerId: offerId, eaContentId: game.eaLaunchId }
      : game;
  });
}
function sameEaProduct(a, b) {
  return (
    a.provider === "EA app" &&
    b.provider === "EA app" &&
    !a.manual &&
    !b.manual &&
    !!a.providerId &&
    a.providerId === b.providerId
  );
}
module.exports = { withEaOfferIdentity, sameEaProduct };
