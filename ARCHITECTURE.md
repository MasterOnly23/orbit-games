# Arquitectura de Orbit Next

La organización sigue responsabilidades del producto. Los módulos de una función conocen sus reglas; el punto de entrada conecta servicios y controla su ciclo de vida. No se divide un archivo solo por superar un número de líneas.

## Proceso principal

| Área | Responsabilidad |
|---|---|
| `electron/main.cjs` | Configurar identidad, cargar biblioteca, conectar servicios, comprobar origen IPC y coordinar cierre y tareas de fondo. |
| `electron/desktop/main-window.cjs` | Crear ventana y bandeja, restricciones de navegación, eventos de foco y comportamiento de cierre. Recibe consultas del estado de cierre; no importa main. |
| `electron/accounts/register.cjs` | Construir registro de proveedores y almacén cifrado, conectar ventanas de autenticación y registrar comandos de cuentas. Devuelve el servicio cancelable. |
| `electron/accounts/coverage.cjs` | Describir capacidades y límites de las plataformas y derivar qué conexiones están habilitadas a partir del registro activo. La UI de cobertura no mantiene su propia lista de conexiones habilitadas. |
| `electron/accounts/<proveedor>.cjs` | Contratos, paginación, autenticación y límites específicos del proveedor. |
| `electron/accounts/service.cjs` | Coordinar operaciones de cuentas, cancelación, identidad y persistencia. |
| `electron/library/enrichment.cjs` | Actualizar fichas respetando activación explícita, frecuencia, exclusión de tareas simultáneas y cierre. |
| `electron/library/scan-service.cjs` | Coordinar lecturas, cancelación y combinación del catálogo con las preferencias actuales. |
| `electron/library/scanner.cjs` | Componer inventario local y fuentes de plataformas. Sus detectores específicos deben continuar separándose por proveedor. |
| `electron/library/steam-local.cjs` y `epic-local.cjs` | Leer manifiestos de cada plataforma, interpretar estados y devolver juegos, avisos, rutas observadas e índices para asociar accesos directos. Reciben operaciones de lectura cancelables desde el coordinador. |
| `electron/library/detected-game.cjs` | Construir el registro base compartido de una detección, sin persistencia ni preferencias del usuario. |
| `electron/library/windows-shortcuts.cjs` | Interpretar accesos y asociarlos con manifiestos ya detectados; distinguir lanzadores compartidos y estados no verificables. |
| `electron/library/windows-registry.cjs` | Detectar entradas adicionales EA, GOG y Ubisoft, excluyendo lanzadores e instaladores y evitando repetir juegos conocidos. |
| `electron/library/xbox-local.cjs` | Reconocer paquetes de juego con MicrosoftGame.config y asociar identidades de Windows sin importar todas las aplicaciones Store. |
| `electron/library/store.cjs` | Cargar y guardar formato persistido, cola de escritura y recuperación. |
| `electron/library/backup.cjs` | Validar, exportar y restaurar catálogo y portadas. |
| `electron/onboarding` | Sugerencias y revisión de carpetas, candidatos y confirmación de la configuración inicial. |
| `electron/lifecycle.cjs` | Registrar trabajo pendiente, cerrar admisión de operaciones y esperar su terminación. |

Los módulos extraídos reciben sus dependencias y estado explícitamente. Ninguno importa `main.cjs`; no hay registro global de servicios ni un objeto de contexto que dé acceso indiscriminado a toda la aplicación. El preload sigue siendo la interfaz estrecha del renderer y no expone credenciales.

## Interfaz

`src/features/library`, `accounts`, `onboarding` y `settings` contienen sus pantallas y flujos. `App.jsx` ensambla la navegación y la biblioteca. Al ampliar organización o búsqueda, extraer filtros/selectores y controles de biblioteca dentro de `features/library`, conservando una única fuente de estado.

## Criterio para próximas ampliaciones

- Un nuevo proveedor se implementa en su módulo y se registra en `accounts/register.cjs`; no se añade su autenticación a main.
- Una nueva fuente local se implementa junto a los detectores de biblioteca y devuelve juegos, avisos y rutas observadas. No persiste ni modifica preferencias por sí misma.
- Steam, Epic, accesos directos, registro y paquetes Windows están separados del coordinador. `scanner.cjs` conserva la composición, acceso al inventario y la inspección manual. Antes de añadir fuentes, utilizar los contratos de los detectores; no volver a introducir sus reglas dentro del coordinador.
- `ipc.cjs` aún agrupa edición, ajustes, archivos, diagnóstico y respaldos. Separar registro de comandos por función al ampliar esos flujos; mantener central la comprobación del remitente y el seguimiento del ciclo de vida.
- Mantener contratos de IPC y formato de biblioteca durante extracciones. Cambios de comportamiento o esquema deben identificarse y verificarse aparte.

## Evidencia de la extracción inicial

En septiembre de 2026 se extrajeron ventana/bandeja, registro de cuentas y actualización de fichas de main. Pasan 72 pruebas y recorridos Electron desde código: escritorio con reinicio y cancelación, cierre con escritura pendiente/error y flujo Epic con respuestas controladas. No acredita cuentas reales ni una nueva generación del paquete alfa 4.

La extracción posterior de Steam/Epic conserva identificadores, estados e índices de asociación por referencia. 74 pruebas pasan, con casos de bibliotecas adicionales y ausentes, estados de instalación, exclusión de redistribuibles, manifiestos dañados e identidad compuesta de Epic. El recorrido Electron de escritorio pasa desde código, con reinicio, cancelación, detección y etiquetas. El paquete alfa 4 existente mantiene su generación anterior.

La extracción de fuentes Windows incorpora el estado de bibliotecas inaccesibles al resultado explícito de Steam. Corrige una referencia residual introducida en la extracción anterior que podía fallar ante accesos Steam sin manifiesto. 78 pruebas y QA de escritorio pasan; los casos nuevos comprueban ese contrato, lanzadores Riot sin instalación comprobada, exclusión de lanzadores/desinstaladores del registro y exclusión de paquetes Store sin manifiesto de juego.
