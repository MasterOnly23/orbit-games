const fs = require("node:fs/promises");
const path = require("node:path");
const { idFor } = require("../library/model.cjs");

async function validateFolders(value) {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error("Puedes seleccionar hasta 20 carpetas de cada tipo.");
  const folders = [];
  for (const folder of value) {
    if (typeof folder !== "string" || !path.isAbsolute(folder))
      throw new Error("Selecciona una carpeta con una ruta absoluta.");
    const resolved = path.resolve(folder);
    if (resolved === path.parse(resolved).root)
      throw new Error(
        "Selecciona una carpeta de juegos, no una unidad completa.",
      );
    const stat = await fs.lstat(resolved).catch(() => null);
    if (!stat?.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        `La carpeta no está disponible o es un enlace: ${resolved}`,
      );
    if (!folders.some((p) => p.toLowerCase() === resolved.toLowerCase()))
      folders.push(resolved);
  }
  return folders;
}

const excludedFolder =
  /^(?:node_modules|windows|\$recycle\.bin|system volume information|_?commonredist|redist|__installer|support|easyanticheat|battleye|\.git)$/i;
const excludedExecutable =
  /(?:unins|uninstall|setup|installer|updat|crash|report|redist|vcredist|dxsetup|unitycrash|easyanticheat|battleye)/i;

async function findExecutableCandidates(roots, limits = {}) {
  const maxDepth = limits.maxDepth ?? 3;
  const maxEntries = limits.maxEntries ?? 5000;
  const maxCandidates = limits.maxCandidates ?? 200;
  const candidates = [],
    warnings = [],
    visited = new Set();
  let inspected = 0,
    truncated = false;
  const queue = roots.map((root) => ({ directory: root, root, depth: 0 }));
  while (queue.length && !truncated) {
    const { directory, root, depth } = queue.shift();
    const key = directory.toLowerCase();
    if (visited.has(key)) continue;
    visited.add(key);
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      warnings.push(`No se pudo leer: ${directory}`);
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++inspected > maxEntries || candidates.length >= maxCandidates) {
        truncated = true;
        break;
      }
      if (entry.isSymbolicLink()) continue;
      const target = path.join(directory, entry.name);
      if (
        entry.isDirectory() &&
        depth < maxDepth &&
        !excludedFolder.test(entry.name)
      )
        queue.push({ directory: target, root, depth: depth + 1 });
      if (
        !entry.isFile() ||
        !/\.exe$/i.test(entry.name) ||
        excludedExecutable.test(entry.name)
      )
        continue;
      candidates.push({
        id: idFor(`manual:${target}`),
        name: path.basename(entry.name, path.extname(entry.name)),
        target,
        root,
      });
    }
  }
  if (truncated)
    warnings.push(
      "La búsqueda llegó al límite. Selecciona carpetas más específicas para encontrar el resto.",
    );
  return { candidates, warnings };
}

async function folderSuggestions(desktop) {
  const folders = [];
  for (const directory of [path.join(desktop, "Games"), desktop]) {
    if ((await fs.stat(directory).catch(() => null))?.isDirectory())
      folders.push(directory);
  }
  return folders;
}

module.exports = {
  validateFolders,
  findExecutableCandidates,
  folderSuggestions,
};
