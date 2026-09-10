const fs = require("node:fs/promises");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");
const { idFor } = require("./model.cjs");
const { abortable } = require("./abortable.cjs");

async function scanItch({
  roots = [path.join(process.env.APPDATA || "", "itch", "apps")],
  signal,
} = {}) {
  const games = [],
    warnings = [],
    watchPaths = [],
    visited = new Set();
  const read = (callback) => abortable(callback, signal);
  let remaining = 2000;
  for (const root of roots) {
    if (!path.isAbsolute(root)) continue;
    const queue = [{ directory: root, depth: 0 }];
    while (queue.length && remaining-- > 0) {
      signal?.throwIfAborted();
      const { directory, depth } = queue.shift(),
        key = path.resolve(directory).toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);
      try {
        const stat = await read(() => fs.lstat(directory));
        if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
        const meta = path.join(directory, ".itch"),
          receipt = path.join(meta, "receipt.json.gz");
        const metaStat = await read(() => fs.lstat(meta).catch(() => null));
        if (metaStat?.isDirectory() && !metaStat.isSymbolicLink()) {
          const info = await read(() => fs.lstat(receipt).catch(() => null));
          if (
            info?.isFile() &&
            !info.isSymbolicLink() &&
            info.size <= 1024 * 1024
          ) {
            const value = JSON.parse(
              gunzipSync(await read(() => fs.readFile(receipt)), {
                maxOutputLength: 4 * 1024 * 1024,
              }).toString("utf8"),
            );
            const game = value.game;
            if (
              Number.isSafeInteger(game?.id) &&
              game.id > 0 &&
              game.classification === "game" &&
              typeof game.title === "string" &&
              game.title.length <= 500 &&
              Array.isArray(value.files)
            ) {
              let present = false;
              const realDirectory = await read(() => fs.realpath(directory));
              for (const file of value.files.slice(0, 200)) {
                if (
                  typeof file !== "string" ||
                  !file ||
                  path.isAbsolute(file) ||
                  file.split(/[\\/]/).includes("..") ||
                  file.includes(":")
                )
                  continue;
                const target = path.join(directory, file);
                const real = await read(() =>
                  fs.realpath(target).catch(() => null),
                );
                if (
                  !real ||
                  path.relative(realDirectory, real).startsWith("..") ||
                  path.isAbsolute(path.relative(realDirectory, real))
                )
                  continue;
                if (
                  (
                    await read(() => fs.stat(target).catch(() => null))
                  )?.isFile()
                ) {
                  present = true;
                  break;
                }
              }
              games.push({
                id: idFor(`itch.io:${game.id}`),
                name: game.title,
                provider: "itch.io",
                providerId: String(game.id),
                installPath: directory,
                sources: [receipt],
                status: present ? "installed" : "unknown",
                statusReason: present
                  ? "Recibo de itch.io y archivos de instalación presentes."
                  : "Recibo de itch.io encontrado; no se pudieron verificar sus archivos.",
                launch: {
                  kind: "uri",
                  target: `itch://install?game_id=${game.id}&launch`,
                },
              });
              watchPaths.push(directory, meta);
            }
          }
        }
        if (depth < 2) {
          watchPaths.push(directory);
          const entries = await read(() =>
            fs.readdir(directory, { withFileTypes: true }),
          );
          for (const entry of entries.slice(0, 2000))
            if (
              entry.isDirectory() &&
              !entry.isSymbolicLink() &&
              ![".itch", "downloads", "node_modules"].includes(
                entry.name.toLowerCase(),
              )
            )
              queue.push({
                directory: path.join(directory, entry.name),
                depth: depth + 1,
              });
        }
      } catch (error) {
        signal?.throwIfAborted();
        if (error.code !== "ENOENT")
          warnings.push(
            "No se pudo comprobar una instalación local de itch.io.",
          );
      }
    }
  }
  if (remaining <= 0)
    warnings.push(
      "La detección de itch.io alcanzó su límite de carpetas. Añade una ubicación más específica.",
    );
  return {
    games,
    warnings: [...new Set(warnings)],
    watchPaths: [...new Set(watchPaths)],
  };
}
module.exports = { scanItch };
