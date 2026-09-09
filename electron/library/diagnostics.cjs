const { effectiveStatus } = require("./model.cjs");
const platforms = new Set([
  "Steam",
  "Epic Games",
  "GOG",
  "Xbox",
  "EA app",
  "Ubisoft",
  "Battle.net",
  "Riot Games",
  "Rockstar Games",
  "Amazon Games",
  "itch.io",
  "Humble Bundle",
]);
const providers = new Set([
  "steam",
  "epic",
  "gog",
  "xbox",
  "ea",
  "ubisoft",
  "battlenet",
  "riot",
  "rockstar",
  "amazon",
  "itch",
  "humble",
]);
const errors = new Set([
  "auth-required",
  "network",
  "unavailable",
  "rate-limit",
  "invalid-response",
  "incomplete",
  "account-mismatch",
  "timeout",
  "cancelled",
  "duplicate",
  "unsupported",
  "busy",
]);
const version = (value) =>
  typeof value === "string" &&
  /^\d+(?:\.\d+){1,3}(?:-[a-z]+\.\d+)?$/i.test(value)
    ? value
    : "unknown";
const count = (value) => (Array.isArray(value) ? value.length : 0);
const timestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value))
    ? value
    : null;

// Allowlist fields and values. Never serialize raw library, errors or logs.
function createDiagnostics(data, runtime, now = new Date().toISOString()) {
  const records = (value) =>
    (Array.isArray(value) ? value : []).filter(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    );
  const games = records(data.games);
  const byPlatform = {},
    byInstallation = { installed: 0, uninstalled: 0, unknown: 0 };
  for (const game of games) {
    const platform = platforms.has(game.provider) ? game.provider : "Other";
    byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    const status = effectiveStatus(game);
    byInstallation[
      Object.hasOwn(byInstallation, status) ? status : "unknown"
    ]++;
  }
  const connectionGroups = new Map();
  for (const account of records(data.accounts)) {
    const provider = providers.has(account.providerId)
      ? account.providerId
      : "other";
    const status = ["connected", "error"].includes(account.status)
      ? account.status
      : "unknown";
    const errorCode = account.error
      ? errors.has(account.error.code)
        ? account.error.code
        : "unknown"
      : null;
    const key = JSON.stringify([provider, status, errorCode]);
    const group = connectionGroups.get(key) || {
      provider,
      status,
      errorCode,
      count: 0,
      lastSuccess: null,
    };
    group.count++;
    const last = timestamp(account.lastSuccess);
    if (last && (!group.lastSuccess || last > group.lastSuccess))
      group.lastSuccess = last;
    connectionGroups.set(key, group);
  }
  return {
    format: "orbit-next-diagnostics",
    version: 1,
    createdAt: timestamp(now),
    application: {
      version: version(runtime.version),
      electron: version(runtime.electron),
      packaged: runtime.packaged === true,
    },
    system: {
      platform: runtime.platform === "win32" ? "win32" : "other",
      release: version(runtime.release),
      architecture: ["x64", "arm64", "ia32"].includes(runtime.architecture)
        ? runtime.architecture
        : "other",
    },
    library: {
      total: games.length,
      byPlatform,
      byInstallation,
      manual: games.filter((game) => game.manual === true).length,
      remoteOnly: games.filter((game) => game.remoteOnly === true).length,
      localArtwork: games.filter((game) => !!game.artworkRevision).length,
      warningCount: count(data.warnings),
      candidateCount: count(data.discovery?.candidates),
      scannedAt: timestamp(data.scannedAt),
      schemaVersion: Number.isSafeInteger(data.version) ? data.version : null,
    },
    configuration: {
      shortcutFolders: count(data.settings?.folders),
      gameFolders: count(data.settings?.gameFolders),
      onlineMetadata: data.settings?.onlineMetadata === true,
      autoScan: data.settings?.autoScan === true,
      onboardingCompleted: !!timestamp(data.onboarding?.completedAt),
    },
    connections: [...connectionGroups.values()],
  };
}
module.exports = { createDiagnostics };
