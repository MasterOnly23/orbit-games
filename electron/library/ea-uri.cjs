// EA's launcher content IDs are not necessarily catalog originOfferIds.
// Keep them separate until a catalog mapping explicitly relates both.
function parseEaLaunchUri(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\x00-\x20]/.test(value)
  )
    return null;
  const legacy =
    /^(?:origin|origin2):\/\/launchgame\/([a-z0-9:._-]{1,256})(?:\?[^#]*)?$/i.exec(
      value,
    );
  if (legacy) return { provider: "EA app", eaLaunchId: legacy[1] };
  try {
    const url = new URL(value);
    if (
      url.protocol !== "origin2:" ||
      url.hostname !== "game" ||
      url.pathname !== "/launch/" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null;
    const entries = [...url.searchParams];
    if (
      entries.length !== 1 ||
      entries[0][0] !== "offerIds" ||
      !/^[a-z0-9:._-]{1,256}$/i.test(entries[0][1])
    )
      return null;
    return { provider: "EA app", eaLaunchId: entries[0][1] };
  } catch {
    return null;
  }
}
module.exports = { parseEaLaunchUri };
