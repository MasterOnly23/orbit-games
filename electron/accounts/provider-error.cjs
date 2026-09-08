class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
function publicError(error) {
  return error instanceof ProviderError
    ? { code: error.code, message: error.message }
    : {
        code: "unavailable",
        message:
          "No se pudo completar la conexión. Tu biblioteca guardada se conserva.",
      };
}
module.exports = { ProviderError, publicError };
