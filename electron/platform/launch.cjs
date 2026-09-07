const path = require("node:path");
const { spawn } = require("node:child_process");
const { exists, read } = require("../library/scanner.cjs");
const { validLaunchUri, effectiveStatus } = require("../library/model.cjs");
function spawnFile(exe, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
      cwd,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
async function launchGame(game, shell) {
  if (effectiveStatus(game) === "uninstalled")
    throw new Error(
      "Este juego figura como no instalado. Instálalo desde su lanzador o corrige su estado en Editar.",
    );
  const launch = game.launch;
  if (!launch?.target)
    throw new Error(
      "Este juego no tiene una ruta de inicio. Agrega su acceso directo.",
    );
  if (launch.kind === "uri") {
    if (!validLaunchUri(launch.target))
      throw new Error("El enlace no es un comando de inicio compatible.");
    await shell.openExternal(launch.target);
    return;
  }
  if (launch.kind === "app") {
    if (!/^[\w.-]+![\w.-]+$/.test(launch.target))
      throw new Error("El identificador de Windows no es válido.");
    await spawnFile(
      path.join(process.env.SystemRoot || "C:\\Windows", "explorer.exe"),
      [`shell:AppsFolder\\${launch.target}`],
    );
    return;
  }
  if (
    launch.kind !== "file" ||
    !path.isAbsolute(launch.target) ||
    ![".exe", ".lnk", ".url"].includes(
      path.extname(launch.target).toLowerCase(),
    )
  )
    throw new Error("La ruta del juego no es compatible.");
  if (!(await exists(launch.target)))
    throw new Error(
      "No se encuentra el ejecutable o acceso directo. Puede estar en una unidad desconectada.",
    );
  if (game.targetExecutable && !(await exists(game.targetExecutable)))
    throw new Error(
      "El acceso directo existe, pero su ejecutable ya no está disponible. Actualiza la ruta.",
    );
  if (/\.url$/i.test(launch.target)) {
    const uri = (await read(launch.target)).match(/^URL=(.+)$/im)?.[1]?.trim();
    if (!validLaunchUri(uri))
      throw new Error("El acceso no contiene un enlace de juego compatible.");
    await shell.openExternal(uri);
    return;
  }
  if (/\.exe$/i.test(launch.target)) {
    try {
      await spawnFile(launch.target, [], path.dirname(launch.target));
      return;
    } catch (error) {
      // Windows ShellExecute can show the standard elevation prompt for an executable that requires it.
      if (!["EACCES", "EPERM"].includes(error.code)) throw error;
    }
  }
  const error = await shell.openPath(launch.target);
  if (error) throw new Error(`Windows no pudo iniciar el juego: ${error}`);
}
module.exports = { launchGame };
