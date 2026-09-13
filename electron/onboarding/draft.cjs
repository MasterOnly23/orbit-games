const path = require("node:path");
const crypto = require("node:crypto");
const { metadataOptions } = require("../library/metadata-options.cjs");

// A draft contains choices, never scan results, executable selections or sessions.
// Missing drives are allowed here; discovery revalidates them before scanning.
function draftFolders(value) {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error("El borrador admite hasta 20 carpetas de cada tipo.");
  const folders = [];
  for (const folder of value) {
    if (
      typeof folder !== "string" ||
      folder.length > 4096 ||
      /[\x00-\x1f]/.test(folder) ||
      !path.isAbsolute(folder)
    )
      throw new Error("El borrador contiene una ruta no válida.");
    const resolved = path.resolve(folder);
    if (resolved === path.parse(resolved).root)
      throw new Error(
        "Selecciona una carpeta de juegos, no una unidad completa.",
      );
    if (!folders.some((item) => item.toLowerCase() === resolved.toLowerCase()))
      folders.push(resolved);
  }
  return folders;
}

function draftChoices(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.onlineMetadata !== "boolean"
  )
    throw new Error("Las preferencias del borrador no son válidas.");
  // Country is allowed to be unfinished while typing; completion validates it.
  if (
    typeof value.metadataCountry !== "string" ||
    !/^[A-Za-z]{0,2}$/.test(value.metadataCountry)
  )
    throw new Error("La región del borrador no es válida.");
  const { metadataLanguage } = metadataOptions({
    metadataLanguage: value.metadataLanguage,
    metadataCountry: "",
  });
  return {
    folders: draftFolders(value.folders),
    gameFolders: draftFolders(value.gameFolders),
    onlineMetadata: value.onlineMetadata,
    metadataLanguage,
    metadataCountry: value.metadataCountry.toUpperCase(),
  };
}

function createSetupDrafts({ store, save, isBusy = () => false }) {
  let session = null;
  let queue = Promise.resolve();
  function enqueue(work) {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  }
  async function replace(draft) {
    const previous = store.data.onboarding;
    const next = { ...previous };
    if (draft) next.draft = draft;
    else delete next.draft;
    store.data.onboarding = next;
    try {
      await save();
    } catch (error) {
      if (store.data.onboarding === next) store.data.onboarding = previous;
      throw new Error(
        "No se pudo guardar el borrador. Revisa el espacio y los permisos, y vuelve a intentarlo.",
        { cause: error },
      );
    }
  }
  function check(token) {
    if (!session || token !== session)
      throw new Error(
        "Este asistente ya no está activo. Vuelve a abrir la configuración.",
      );
    if (isBusy())
      throw new Error("Espera a que termine la operación del asistente.");
  }
  return {
    begin: () =>
      enqueue(() => {
        if (isBusy())
          throw new Error("Espera a que termine la operación del asistente.");
        const saved = store.data.onboarding.draft;
        if (saved && saved.version !== 1)
          throw new Error(
            "El borrador pertenece a otra versión de Orbit Next. No se ha modificado.",
          );
        const choices = saved ? draftChoices(saved.choices) : null;
        session = crypto.randomUUID();
        return { session, choices };
      }),
    write: (token, value) => {
      // Copy and validate before waiting; the caller cannot mutate queued input.
      let choices;
      try {
        choices = draftChoices(value);
      } catch (error) {
        return Promise.reject(error);
      }
      return enqueue(async () => {
        check(token);
        await replace({
          version: 1,
          updatedAt: new Date().toISOString(),
          choices,
        });
        return true;
      });
    },
    discard: (token) =>
      enqueue(async () => {
        check(token);
        await replace(null);
        session = null;
        return true;
      }),
    flush: () => queue,
    invalidate: () => {
      session = null;
    },
  };
}

module.exports = { createSetupDrafts, draftChoices };
