const fs = require("node:fs/promises");
const path = require("node:path");
const { idFor } = require("./model.cjs");
const products = {
  league_of_legends: {
    name: "League of Legends",
    executables: ["LeagueClient.exe"],
  },
  valorant: {
    name: "VALORANT",
    executables: ["VALORANT.exe", "live/VALORANT.exe"],
  },
};
async function readManifest(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024)
    throw new Error("Unsupported manifest");
  return fs.readFile(file, "utf8");
}
const isFile = async (file) =>
  !!file && (await fs.stat(file).catch(() => null))?.isFile();
const normalized = (value) =>
  path
    .resolve(value)
    .replace(/[\\/]+$/, "")
    .toLowerCase();
function installationPath(text) {
  const line = text.match(/^product_install_full_path:\s*(.+)$/m)?.[1]?.trim();
  if (!line) return null;
  try {
    const value = line.startsWith('"')
      ? JSON.parse(line)
      : line.startsWith("'") && line.endsWith("'")
        ? line.slice(1, -1).replace(/''/g, "'")
        : line;
    return typeof value === "string" && path.isAbsolute(value)
      ? path.resolve(value)
      : null;
  } catch {
    return null;
  }
}
async function scanRiot(
  programData = process.env.ProgramData || "C:\\ProgramData",
) {
  const directory = path.join(programData, "Riot Games"),
    metadata = path.join(directory, "Metadata");
  const games = [],
    warnings = [],
    watchPaths = [];
  const root = await fs.lstat(directory).catch(() => null);
  if (!root?.isDirectory() || root.isSymbolicLink())
    return { games, warnings, watchPaths };
  watchPaths.push(directory, metadata);
  let clients;
  try {
    clients = JSON.parse(
      await readManifest(path.join(directory, "RiotClientInstalls.json")),
    );
  } catch {
    warnings.push("No se pudo leer el registro de instalaciones de Riot.");
    return { games, warnings, watchPaths };
  }
  const entries = await fs
    .readdir(metadata, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries.slice(0, 100)) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const match = /^(league_of_legends|valorant)\.(live|pbe)$/.exec(entry.name);
    if (!match) continue;
    const [, product, channel] = match,
      descriptor = products[product];
    const file = path.join(
      metadata,
      entry.name,
      `${entry.name}.product_settings.yaml`,
    );
    let installPath;
    try {
      installPath = installationPath(await readManifest(file));
    } catch {
      continue;
    }
    if (!installPath) continue;
    let executable;
    for (const relative of descriptor.executables) {
      const candidate = path.join(installPath, relative);
      if (await isFile(candidate)) {
        executable = candidate;
        break;
      }
    }
    if (!executable) continue;
    const associated = Object.entries(clients.associated_client || {}).find(
      ([root]) => normalized(root) === normalized(installPath),
    )?.[1];
    const client = associated || clients.rc_live || clients.rc_default;
    if (
      typeof client !== "string" ||
      !path.isAbsolute(client) ||
      path.basename(client).toLowerCase() !== "riotclientservices.exe" ||
      !(await isFile(client))
    ) {
      warnings.push(
        `Se encontró ${descriptor.name}, pero su Riot Client no está disponible.`,
      );
      continue;
    }
    watchPaths.push(path.dirname(file), installPath);
    games.push({
      id: idFor(`riot:${product}:${channel}`),
      provider: "Riot Games",
      providerId: `${product}:${channel}`,
      name: descriptor.name + (channel === "pbe" ? " (PBE)" : ""),
      installPath,
      targetExecutable: executable,
      launch: { kind: "file", target: path.resolve(client) },
      launchOptions: {
        args: [`--launch-product=${product}`, `--launch-patchline=${channel}`],
        workingDirectory: path.dirname(path.resolve(client)),
      },
      status: "installed",
      statusReason:
        "Manifiesto de Riot, ejecutable del juego y Riot Client disponibles.",
      sources: [file],
    });
  }
  return { games, warnings, watchPaths };
}
module.exports = { scanRiot, installationPath };
