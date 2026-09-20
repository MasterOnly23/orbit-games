const { ProviderError } = require("./provider-error.cjs");
const { abortable } = require("../library/abortable.cjs");
const validId = (value) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9:._-]{0,255}$/i.test(value);
function invalid() {
  throw new ProviderError(
    "incomplete",
    "EA no devolvió una correspondencia de ofertas verificable.",
  );
}
function parseEaOffers(response, requested) {
  if (
    !Array.isArray(requested) ||
    requested.length > 100 ||
    requested.some((id) => !validId(id)) ||
    new Set(requested).size !== requested.length
  )
    invalid();
  if (
    response?.errors !== undefined &&
    (!Array.isArray(response.errors) || response.errors.length)
  )
    invalid();
  const items = response?.data?.legacyOffers;
  if (!Array.isArray(items) || items.length !== requested.length) invalid();
  const seen = new Set();
  return items.map((item) => {
    if (
      !validId(item?.offerId) ||
      !requested.includes(item.offerId) ||
      seen.has(item.offerId)
    )
      invalid();
    seen.add(item.offerId);
    // Missing content identifiers do not justify inferring one from an offer ID.
    if (item.contentId !== null && !validId(item.contentId)) invalid();
    return { offerId: item.offerId, contentId: item.contentId };
  });
}

async function readEaOfferMapping(offerIds, requestOffers, { signal } = {}) {
  if (
    !Array.isArray(offerIds) ||
    offerIds.length > 10000 ||
    offerIds.some((id) => !validId(id))
  )
    invalid();
  const requested = [...new Set(offerIds)];
  const byContent = new Map();
  for (let offset = 0; offset < requested.length; offset += 100) {
    signal?.throwIfAborted();
    const batch = requested.slice(offset, offset + 100);
    const response = await abortable(
      () => requestOffers(batch, { signal }),
      signal,
    );
    for (const { offerId, contentId } of parseEaOffers(response, batch)) {
      if (contentId === null) continue;
      // Editions may share content. Ambiguity is global, including across batches.
      if (byContent.has(contentId)) byContent.set(contentId, null);
      else byContent.set(contentId, offerId);
    }
  }
  signal?.throwIfAborted();
  return [...byContent]
    .filter(([, offerId]) => offerId !== null)
    .map(([contentId, offerId]) => ({ contentId, offerId }));
}
module.exports = { parseEaOffers, readEaOfferMapping };
