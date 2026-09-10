const platforms = [
  {
    id: "steam",
    name: "Steam",
    local:
      "Manifiestos de Steam y accesos directos; contempla bibliotecas en varias unidades.",
    account:
      "Consulta la biblioteca devuelta por Steam, incluidos juegos sin instalar. El acceso a juegos compartidos no está garantizado.",
  },
  {
    id: "epic",
    name: "Epic Games",
    local: "Manifiestos del lanzador y accesos directos.",
    account:
      "Consulta juegos del catálogo de la cuenta. La importación excluye complementos identificados como DLC.",
  },
  {
    id: "gog",
    name: "GOG",
    local:
      "Entradas del registro de Windows; requiere una ruta de ejecutable reconocible.",
    account: "Consulta paginada de la biblioteca de la cuenta.",
  },
  {
    id: "ubisoft",
    name: "Ubisoft Connect",
    local: "Registro de Windows y accesos uplay compatibles.",
    account:
      "Consulta derechos de la cuenta. La correspondencia de todas las ediciones con Windows sigue sin verificar.",
  },
  {
    id: "humble",
    name: "Humble Bundle",
    local: "Añade las descargas manualmente o revisa sus carpetas de juegos.",
    account:
      "Importa descargas para Windows y referencias a otras tiendas. No importa ni activa códigos de canje; identifica la conexión por su sesión local.",
  },
  {
    id: "itch",
    name: "itch.io",
    local:
      "Recibos de instalación en la carpeta predeterminada y en las carpetas de juegos configuradas. Requiere el lanzador para abrir el juego por su enlace.",
    account:
      "El conector de cuenta requiere habilitación de Orbit y validación real. La detección local puede usarse sin conectar una cuenta.",
  },
  {
    id: "xbox",
    name: "Xbox / Microsoft Store",
    local:
      "Paquetes de juegos con manifiestos reconocidos y accesos de Windows. No importa automáticamente todas las aplicaciones Store.",
    account:
      "La biblioteca de cuenta y el catálogo de Game Pass no están implementados.",
  },
  {
    id: "ea",
    name: "EA app",
    local: "Registro de Windows y accesos directos o enlaces compatibles.",
    account: "La consulta de biblioteca de cuenta no está implementada.",
  },
  {
    id: "battlenet",
    name: "Battle.net",
    local:
      "Accesos compatibles. Encontrar el lanzador no acredita toda la biblioteca instalada.",
    account: "La consulta de biblioteca de cuenta no está implementada.",
  },
  {
    id: "riot",
    name: "Riot Games",
    local:
      "Manifiestos de League of Legends y VALORANT, junto con accesos directos. El lanzador compartido por sí solo no confirma una instalación.",
    account: "La consulta de biblioteca de cuenta no está implementada.",
  },
  {
    id: "rockstar",
    name: "Rockstar Games",
    local: "Accesos directos reconocidos o alta manual del juego.",
    account: "La consulta de biblioteca de cuenta no está implementada.",
  },
  {
    id: "amazon",
    name: "Amazon Games",
    local:
      "Alta manual o revisión de carpetas. No hay detector específico de Amazon en esta versión.",
    account: "La consulta de biblioteca de cuenta no está implementada.",
  },
];

function platformCoverage(providers) {
  return platforms.map((platform) => ({
    ...platform,
    canConnect: Object.hasOwn(providers, platform.id),
  }));
}
module.exports = { platformCoverage };
