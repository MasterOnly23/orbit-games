const fs = require("node:fs/promises");
const path = require("node:path");

async function fileAvailability(target, stat = fs.stat) {
  try {
    const entry = await stat(target);
    return entry.isFile()
      ? { status: "installed", statusReason: "El ejecutable está disponible." }
      : {
          status: "unknown",
          statusReason: "La ruta no corresponde a un archivo de juego.",
        };
  } catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes(error.code))
      return {
        status: "unknown",
        statusReason:
          "No se pudo acceder al archivo. Revisa los permisos y la unidad.",
      };
    try {
      await stat(path.parse(target).root);
    } catch {
      return {
        status: "unknown",
        statusReason:
          "La unidad no está disponible. Reconéctala y vuelve a buscar juegos.",
      };
    }
    return {
      status: "uninstalled",
      statusReason:
        "El archivo ya no está en la ruta guardada. Puede haberse movido o desinstalado.",
    };
  }
}
module.exports = { fileAvailability };
