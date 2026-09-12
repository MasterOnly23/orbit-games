const languages = require("./metadata-languages.json");
function metadataOptions(settings = {}) {
  const metadataLanguage = settings.metadataLanguage ?? "spanish";
  const metadataCountry = settings.metadataCountry ?? "";
  if (
    typeof metadataLanguage !== "string" ||
    !Object.hasOwn(languages, metadataLanguage)
  )
    throw new Error("Selecciona un idioma de fichas válido.");
  if (
    typeof metadataCountry !== "string" ||
    !/^(?:[A-Z]{2})?$/.test(metadataCountry)
  )
    throw new Error(
      "La región debe estar vacía o usar dos letras mayúsculas, como AR, ES o US.",
    );
  return { metadataLanguage, metadataCountry };
}
module.exports = { metadataOptions };
