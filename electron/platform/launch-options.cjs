const fs = require("node:fs/promises");
const path = require("node:path");

async function validateLaunchOptions(launch, value) {
  if (
    !value ||
    !Array.isArray(value.args) ||
    value.args.length > 64 ||
    value.args.some(
      (arg) =>
        typeof arg !== "string" || arg.length > 2048 || /[\x00\r\n]/.test(arg),
    ) ||
    typeof value.workingDirectory !== "string" ||
    value.workingDirectory.length > 2048
  )
    throw new Error(
      "Indica hasta 64 argumentos y una carpeta de trabajo válida.",
    );
  const args = [...value.args],
    workingDirectory = value.workingDirectory.trim();
  if (
    (args.length || workingDirectory) &&
    (launch?.kind !== "file" ||
      path.extname(launch.target).toLowerCase() !== ".exe")
  )
    throw new Error(
      "Los argumentos y la carpeta de trabajo requieren un ejecutable .exe. Los accesos directos conservan su propia configuración.",
    );
  if (
    workingDirectory &&
    (!path.isAbsolute(workingDirectory) ||
      !(await fs.stat(workingDirectory).catch(() => null))?.isDirectory())
  )
    throw new Error(
      "La carpeta de trabajo no está disponible. Selecciona una carpeta existente.",
    );
  return {
    args,
    workingDirectory: workingDirectory ? path.resolve(workingDirectory) : "",
  };
}
module.exports = { validateLaunchOptions };
