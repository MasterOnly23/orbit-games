const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { validLaunchUri } = require("./model.cjs");
const playStatuses = require("./play-status.json");

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_IMAGE = 20 * 1024 * 1024;
const idPattern = /^[a-f0-9]{20}$/;
const imagePattern = /^[a-f0-9]{64}\.jpg$/;
const invalid = () => {
  throw new Error(
    "El respaldo contiene datos no válidos o supera los límites permitidos.",
  );
};
function string(value, max) {
  if (typeof value !== "string" || value.length > max || value.includes("\0"))
    invalid();
  return value;
}
function artworkName(game) {
  if (!idPattern.test(game.id)) invalid();
  return imagePattern.test(game.artworkFile || "")
    ? game.artworkFile
    : `${game.id}.jpg`;
}
function preferences(value) {
  const result = {};
  if (value.playStatus !== undefined) {
    if (
      typeof value.playStatus !== "string" ||
      !Object.hasOwn(playStatuses, value.playStatus)
    )
      invalid();
    result.playStatus = value.playStatus;
  }
  for (const key of ["favorite", "hidden"])
    if (typeof value[key] === "boolean") result[key] = value[key];
  for (const [key, max] of [
    ["notes", 5000],
    ["customName", 200],
    ["lastPlayed", 40],
    ["addedAt", 40],
  ])
    if (value[key] != null) result[key] = string(value[key], max);
  if (
    ["auto", "installed", "uninstalled", "unknown"].includes(
      value.statusOverride,
    )
  )
    result.statusOverride = value.statusOverride;
  if (Number.isSafeInteger(value.launchCount) && value.launchCount >= 0)
    result.launchCount = value.launchCount;
  return result;
}
function gameRecord(value) {
  if (!value || !idPattern.test(value.id)) invalid();
  const result = {
    id: value.id,
    name: string(value.name, 500),
    provider: string(value.provider, 100),
    ...preferences(value),
  };
  if (!result.name.trim()) invalid();
  for (const key of ["providerId", "steamId", "accountAccessNote"])
    if (value[key] != null) result[key] = string(String(value[key]), 500);
  for (const key of ["installPath", "targetExecutable"])
    if (value[key]) {
      result[key] = string(value[key], 2048);
      if (!path.win32.isAbsolute(result[key])) invalid();
    }
  result.manual = value.manual === true;
  result.remoteOnly = value.remoteOnly === true;
  if (value.launch) {
    const target = string(value.launch.target, 2048),
      kind = value.launch.kind;
    if (
      !(kind === "uri" && validLaunchUri(target)) &&
      !(kind === "app" && /^[\w.-]+![\w.-]+$/.test(target)) &&
      !(
        kind === "file" &&
        path.win32.isAbsolute(target) &&
        /\.(exe|lnk|url)$/i.test(target)
      )
    )
      invalid();
    result.launch = { kind, target };
  }
  if (value.launchOptions) {
    const options = value.launchOptions;
    if (!Array.isArray(options.args) || options.args.length > 64) invalid();
    const args = options.args.map((arg) => string(arg, 2048));
    if (args.some((arg) => /[\r\n]/.test(arg))) invalid();
    const workingDirectory = string(options.workingDirectory, 2048);
    if (workingDirectory && !path.win32.isAbsolute(workingDirectory)) invalid();
    if (
      (args.length || workingDirectory) &&
      !(result.launch?.kind === "file" && /\.exe$/i.test(result.launch.target))
    )
      invalid();
    result.launchOptions = { args, workingDirectory };
  }
  if (value.metadata) {
    const metadata = {};
    for (const key of [
      "steamId",
      "title",
      "description",
      "releaseDate",
      "fetchedAt",
    ])
      if (value.metadata[key] != null)
        metadata[key] = string(
          value.metadata[key],
          key === "description" ? 20000 : 500,
        );
    for (const key of ["hero", "header", "cover", "sourceUrl"])
      if (value.metadata[key]) {
        const raw = string(value.metadata[key], 2048);
        const url = new URL(raw);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          ![
            "store.steampowered.com",
            "shared.fastly.steamstatic.com",
            "cdn.akamai.steamstatic.com",
            "cdn.cloudflare.steamstatic.com",
            "shared.akamai.steamstatic.com",
            "shared.cloudflare.steamstatic.com",
          ].includes(url.hostname)
        )
          invalid();
        metadata[key] = raw;
      }
    for (const key of ["genres", "developers", "publishers"])
      if (value.metadata[key]) {
        if (
          !Array.isArray(value.metadata[key]) ||
          value.metadata[key].length > 100
        )
          invalid();
        metadata[key] = value.metadata[key].map((item) => string(item, 500));
      }
    if (Number.isFinite(value.metadata.score))
      metadata.score = value.metadata.score;
    result.metadata = metadata;
  }
  return result;
}
async function boundedRead(file, max) {
  const handle = await fs.open(file, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > max) invalid();
    const bytes = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > stat.size) invalid();
    return bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
async function createBackup(store) {
  const snapshot = structuredClone(store.data.games);
  if (snapshot.length > 10000) invalid();
  const games = snapshot.map(gameRecord),
    artwork = [];
  let size = Buffer.byteLength(JSON.stringify(games));
  for (const game of snapshot) {
    if (!game.artworkRevision) continue;
    const bytes = await boundedRead(
      path.join(store.directory, "artwork", artworkName(game)),
      MAX_IMAGE,
    );
    const data = bytes.toString("base64");
    size += data.length + 256;
    if (size > MAX_BYTES - 1024) invalid();
    artwork.push({
      id: game.id,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      data,
    });
  }
  return {
    format: "orbit-next-library",
    version: 2,
    createdAt: new Date().toISOString(),
    games,
    artwork,
  };
}
async function writeBackup(file, backup) {
  const content = JSON.stringify(backup);
  if (Buffer.byteLength(content) > MAX_BYTES) invalid();
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function readBackup(file, validateImage) {
  const raw = await boundedRead(file, MAX_BYTES);
  const value = JSON.parse(raw.toString("utf8"));
  if (value.version === 1 && Array.isArray(value.preferences)) {
    if (value.preferences.length > 10000) invalid();
    return {
      legacy: true,
      games: value.preferences.map((item) => {
        if (!item || !idPattern.test(item.id)) invalid();
        return { id: item.id, ...preferences(item) };
      }),
      artwork: [],
    };
  }
  if (
    value.format !== "orbit-next-library" ||
    value.version !== 2 ||
    !Array.isArray(value.games) ||
    value.games.length > 10000 ||
    !Array.isArray(value.artwork) ||
    value.artwork.length > value.games.length
  )
    invalid();
  const games = value.games.map(gameRecord),
    ids = new Set(games.map((g) => g.id));
  if (ids.size !== games.length) invalid();
  const seen = new Set(),
    artwork = [];
  for (const item of value.artwork) {
    if (
      !item ||
      !ids.has(item.id) ||
      seen.has(item.id) ||
      typeof item.data !== "string" ||
      item.data.length > Math.ceil(MAX_IMAGE / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data)
    )
      invalid();
    const bytes = Buffer.from(item.data, "base64");
    if (
      !bytes.length ||
      bytes.length > MAX_IMAGE ||
      bytes.toString("base64") !== item.data ||
      createHash("sha256").update(bytes).digest("hex") !== item.sha256
    )
      invalid();
    if (!validateImage(bytes))
      throw new Error("El respaldo contiene una portada que no se puede leer.");
    seen.add(item.id);
    artwork.push({ id: item.id, bytes, file: `${item.sha256}.jpg` });
  }
  return { legacy: false, games, artwork };
}
async function restoreBackup(store, backup, save) {
  // Immutable artwork is staged first: failures never overwrite a current cover.
  const directory = path.join(store.directory, "artwork");
  await fs.mkdir(directory, { recursive: true });
  for (const item of backup.artwork) {
    const file = path.join(directory, item.file);
    try {
      await fs.writeFile(file, item.bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (!(await boundedRead(file, MAX_IMAGE)).equals(item.bytes))
        throw new Error(
          "Una portada local está dañada. Se conserva la biblioteca actual.",
        );
    }
  }
  const before = store.data.games,
    byId = new Map(before.map((g) => [g.id, g]));
  let count = 0;
  for (const imported of backup.games) {
    const current = byId.get(imported.id);
    if (backup.legacy && !current) continue;
    const game = current
      ? {
          ...current,
          ...preferences(imported),
          ...(imported.metadata ? { metadata: imported.metadata } : {}),
        }
      : {
          ...imported,
          sources: [],
          accountEntitlements: [],
          status: "unknown",
          statusOverride: "auto",
          statusReason:
            "Restaurado desde una copia. Verifica la ruta o vuelve a detectar los juegos en este equipo.",
          manual: !!imported.launch && !imported.remoteOnly,
          remoteOnly: !imported.launch || imported.remoteOnly,
        };
    const image = backup.artwork.find((item) => item.id === imported.id);
    if (image) {
      game.artworkFile = image.file;
      game.artworkRevision = Date.now();
    }
    byId.set(game.id, game);
    count++;
  }
  const next = [...byId.values()];
  store.data.games = next;
  try {
    await save();
  } catch (error) {
    if (store.data.games === next) store.data.games = before;
    throw error;
  }
  return count;
}
module.exports = {
  artworkName,
  createBackup,
  writeBackup,
  readBackup,
  restoreBackup,
};
