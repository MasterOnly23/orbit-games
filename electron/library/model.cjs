const crypto = require("node:crypto");
const path = require("node:path");
const normalize = (value) =>
  String(value || "")
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const idFor = (value) =>
  crypto
    .createHash("sha256")
    .update(value.toLowerCase())
    .digest("hex")
    .slice(0, 20);
function parseVdf(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}]/g) || [];
  let index = 0;
  const decode = (token) =>
    token.slice(1, -1).replace(/\\\\/g, "\\").replace(/\\"/g, '"');
  function object() {
    const result = {};
    while (index < tokens.length) {
      const token = tokens[index++];
      if (token === "}") break;
      if (token === "{") continue;
      const key = decode(token),
        next = tokens[index++];
      if (!next) break;
      result[key] = next === "{" ? object() : decode(next);
    }
    return result;
  }
  return object();
}
function classifyUri(uri) {
  if (/^steam:\/\/(?:rungameid|run)\/\d+\/?$/i.test(uri))
    return { provider: "Steam", steamId: uri.match(/\d+/)[0] };
  if (/^com\.epicgames\.launcher:\/\/apps\//i.test(uri))
    return { provider: "Epic Games" };
  if (/^uplay:\/\/launch\/\d+(?:\/\d+)?\/?$/i.test(uri))
    return { provider: "Ubisoft", providerId: uri.split("/")[3] };
  if (/^(?:origin|origin2):\/\/launchgame\//i.test(uri))
    return { provider: "EA app" };
  if (/^battlenet:\/\//i.test(uri)) return { provider: "Battle.net" };
  return null;
}
function validLaunchUri(uri) {
  if (typeof uri !== "string" || uri.length > 2048 || /[\r\n\x00]/.test(uri))
    return false;
  const data = classifyUri(uri);
  if (!data) return false;
  if (data.provider === "Epic Games")
    return /^com\.epicgames\.launcher:\/\/apps\/[a-z0-9%:_-]+\?action=launch(?:&silent=true)?$/i.test(
      uri,
    );
  if (data.provider === "EA app")
    return /^(?:origin|origin2):\/\/launchgame\/[a-z0-9:_-]+(?:\?.*)?$/i.test(
      uri,
    );
  if (data.provider === "Battle.net")
    return /^battlenet:\/\/[a-z0-9\/_-]+$/i.test(uri);
  return true;
}
function sameProviderTitle(a, b) {
  if (a.provider !== b.provider || normalize(a.name) !== normalize(b.name))
    return false;
  if (
    a.providerId &&
    b.providerId &&
    String(a.providerId) !== String(b.providerId)
  )
    return false;
  if (a.steamId && b.steamId && String(a.steamId) !== String(b.steamId))
    return false;
  return true;
}
function mergeGames(detected, previous = []) {
  const result = [];
  for (const candidate of detected) {
    // Same provider/title or exact launch identity only: keep editions and different stores separate.
    const existing = result.find(
      (g) => g.id === candidate.id || sameProviderTitle(g, candidate),
    );
    if (existing) {
      if (candidate.status === "installed" && existing.status !== "installed")
        Object.assign(existing, candidate, { id: existing.id });
      existing.sources = [
        ...new Set([...existing.sources, ...candidate.sources]),
      ];
      if (!existing.steamId && candidate.steamId)
        existing.steamId = candidate.steamId;
      if (!existing.installPath && candidate.installPath)
        existing.installPath = candidate.installPath;
    } else result.push({ ...candidate, sources: [...candidate.sources] });
  }
  const now = new Date().toISOString();
  for (let i = 0; i < result.length; i++) {
    const candidate = result[i];
    const old =
      previous.find((g) => g.id === candidate.id) ||
      previous.find(
        (g) =>
          g.id === candidate.id ||
          sameProviderTitle(g, candidate) ||
          g.sources?.some((p) => candidate.sources.includes(p)),
      );
    result[i] = {
      ...candidate,
      id: old?.id || candidate.id,
      addedAt: old?.addedAt || now,
      lastPlayed: old?.lastPlayed || null,
      launchCount: old?.launchCount || 0,
      favorite: old?.favorite || false,
      hidden: old?.hidden || false,
      notes: old?.notes || "",
      statusOverride: old?.statusOverride || "auto",
      metadata: old?.metadata || null,
      metadataCheckedAt: old?.metadataCheckedAt,
      customName: old?.customName || "",
      artworkRevision: old?.artworkRevision || null,
      launchOptions: old?.launchOptions || candidate.launchOptions,
      accountEntitlements:
        old?.accountEntitlements || candidate.accountEntitlements || [],
      platformPlaytimeMinutes: old?.platformPlaytimeMinutes,
      remoteOnly: false,
    };
    if (old?.manual)
      Object.assign(result[i], {
        manual: true,
        launch: old.launch,
        targetExecutable: old.targetExecutable,
        installPath: old.installPath,
        status: old.status,
        statusReason: old.statusReason,
      });
  }
  for (const old of previous) {
    if (result.some((g) => g.id === old.id)) continue;
    if (old.manual || old.remoteOnly) {
      result.push(old);
      continue;
    }
    if (
      result.some((g) =>
        old.sources?.some((source) => g.sources.includes(source)),
      )
    )
      continue;
    result.push({
      ...old,
      status: "unknown",
      statusReason:
        "La fuente ya no aparece en el escaneo. Revisa el acceso o la unidad.",
      sources: [],
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
const effectiveStatus = (game) =>
  game.statusOverride && game.statusOverride !== "auto"
    ? game.statusOverride
    : game.status;
const executableFromIcon = (value) =>
  String(value || "")
    .replace(/^"([^"]+)".*$/, "$1")
    .replace(/,\s*-?\d+$/, "");
module.exports = {
  normalize,
  idFor,
  parseVdf,
  classifyUri,
  validLaunchUri,
  mergeGames,
  effectiveStatus,
  executableFromIcon,
};
