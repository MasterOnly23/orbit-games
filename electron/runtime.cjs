const fs = require("node:fs");
const path = require("node:path");

const identity = {
  name: "Orbit Games Next",
  appId: "com.pipe.orbitgames.next",
  loginName: "OrbitGamesNext",
};

function resolveDataDirectory(appData, override) {
  const root = path.resolve(appData, identity.name);
  const directory = override ? path.resolve(override) : root;
  const relative = path.relative(root, directory);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(
      "Orbit Next solo puede guardar datos dentro de su propio perfil.",
    );
  // Reject junctions so a test profile cannot redirect writes to another app.
  let current = root;
  for (const part of ["", ...relative.split(path.sep).filter(Boolean)]) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(
        "El perfil de Orbit Next no puede ser un enlace a otra carpeta.",
      );
  }
  return directory;
}

function configureRuntime(app, override = process.env.ORBIT_DATA_DIR) {
  app.setName(identity.name);
  const directory = resolveDataDirectory(app.getPath("appData"), override);
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(directory, "logs"), { recursive: true });
  app.setPath("userData", directory);
  app.setPath("sessionData", directory);
  app.setPath("logs", path.join(directory, "logs"));
  return directory;
}

module.exports = { identity, resolveDataDirectory, configureRuntime };
