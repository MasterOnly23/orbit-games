const { idFor } = require("./model.cjs");
function game(name, provider, identity, props) {
  return {
    id: idFor(identity),
    name,
    provider,
    status: "unknown",
    statusReason: "No se pudo comprobar la instalación.",
    sources: [],
    ...props,
  };
}

module.exports = { game };
