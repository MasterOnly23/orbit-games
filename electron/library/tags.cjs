function validateTags(value = []) {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error("Usa como máximo 20 etiquetas por juego.");
  const result = [],
    seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || /[\x00-\x1f\x7f]/.test(entry))
      throw new Error("Las etiquetas deben ser texto en una sola línea.");
    const tag = entry.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!tag || tag.length > 40)
      throw new Error("Cada etiqueta debe tener entre 1 y 40 caracteres.");
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      result.push(tag);
      seen.add(key);
    }
  }
  return result;
}
module.exports = { validateTags };
