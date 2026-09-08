# Orbit Next — Producto para uso público

Objetivo vigente: conectar cuentas de todas las plataformas que podamos soportar de forma viable, detectar y organizar juegos instalados o pertenecientes a cuentas, y entregar una aplicación que el público pueda instalar, configurar, usar y mantener sin asistencia del desarrollador. La monetización se decidirá después; no es un requisito de esta entrega.

Este objetivo amplía el primer asistente de `e9883d5`. No se considera terminado por tener una demostración local, conectores simulados ni pruebas de una sola plataforma.

## Invariantes

- Orbit Games 1.0.0, su instalación, acceso directo y perfil permanecen independientes. El trabajo continúa en Next y fuera de main.
- La biblioteca local funciona sin conexión y sin cuentas. Conectar una cuenta es opcional.
- No se piden contraseñas en formularios propios de Orbit. Las sesiones se protegen en el equipo; no se exponen al renderizador, registros, exportaciones ni Git.
- Propiedad o acceso, instalación y ficha del juego son conceptos separados. No se confunde una suscripción, juego compartido o historial de partidas con una compra.
- Un fallo, respuesta incompleta, sesión vencida o desconexión de disco no borra juegos, portadas ni preferencias.
- Cada conector publica sus capacidades reales, procedencia, límites y fecha de comprobación. Ningún botón de conexión simulado cuenta como soporte.
- No se ejecutan archivos descubiertos para identificarlos. La instalación y desinstalación de juegos requieren acciones explícitas del usuario.

## Decisiones confirmadas por el usuario

1. Admitir APIs oficiales y conectores comunitarios mantenidos, indicando sus limitaciones.
2. Priorizar funcionamiento íntegramente local, sin servidores propios. Si un servidor resulta absolutamente necesario para una función, explicar la necesidad al usuario antes de incorporarlo.
3. Windows 10 y Windows 11 x64 desde la primera versión pública. Ambos requieren verificación; probar solo Windows 11 no acredita Windows 10.

La arquitectura no debe exigir una cuenta Orbit para usar una biblioteca local. La sincronización, las sesiones y el inventario se mantienen en el equipo del usuario.

Ampliación explícita del usuario: agregar todas las conexiones viables y admitir juegos manuales, sin plataforma o con su propio lanzador. El soporte manual no reemplaza ninguna integración viable; ambos recorridos forman parte del producto.

## Requisitos y evidencia de aceptación

| ID | Requisito | Evidencia necesaria | Estado |
|---|---|---|---|
| ISO | Separación de Orbit actual | Identidades, perfiles, paquetes y ejecución simultánea comprobados; hash del instalado conservado | Base implementada, mantener en cada entrega |
| ONB | Onboarding posterior a instalación | Perfil nuevo: idioma/región, carpetas, permisos de consulta, conexión opcional de cuentas, revisión, progreso, reanudación y ayuda | Parcial: carpetas y revisión |
| ACC | Cuentas multiplataforma | Login real, biblioteca real, renovación, revocación/desconexión y cambio de cuenta por cada proveedor soportado | Pendiente |
| CAT | Biblioteca completa | Unión de inventario local y acceso remoto sin duplicados incorrectos; conserva ediciones, tiendas, datos manuales y fuentes | Pendiente |
| DET | Detección sólida | Fixtures por proveedor y pruebas en otras máquinas: rutas personalizadas, múltiples discos, manifiestos incompletos, unidades ausentes y accesos ambiguos | Parcial |
| CORE | Funciones actuales de Orbit | Agregar/editar, iniciar, revelar ubicación, favoritos, recientes, filtros, búsqueda, fichas, imágenes y ajustes comprobados de extremo a extremo | Parcial |
| ORG | Organización útil | Colecciones, etiquetas/estado de juego, filtros combinables y tratamiento explícito de duplicados | Pendiente |
| DATA | Recuperación y respaldo | Guardado resistente, migraciones, copia completa con portadas, importación validada, cancelación y recuperación tras fallos | Parcial |
| ART | Fichas y portadas | Proveedor/atribución, caché persistente, recuperación, elección manual y funcionamiento sin red | Parcial |
| AUTH | Protección de cuentas | Almacenamiento protegido, límites de navegación, expiración y errores saneados; verificación de ausencia de secretos en IPC/logs/exportación | Pendiente |
| UX | Uso autónomo y accesible | Teclado, escalados, estados vacíos/errores/carga, cancelación de escaneo, idioma/región configurable y mensajes accionables | Parcial |
| OPS | Diagnóstico y soporte | Informe exportable sin secretos, versiones de conectores, últimas sincronizaciones, ayuda y canal de incidencias | Pendiente |
| DIST | Distribución pública | Instalación limpia por usuario estándar, actualización preservando datos, desinstalación sin pérdida inesperada, artefactos identificados y mecanismo de confianza/firma | Pendiente |
| RIGHTS | Condiciones de distribución | Licencias y avisos de dependencias/conectores/contenido, política de privacidad coherente con los flujos reales | Pendiente |
| RELEASE | Candidato público validado | Matriz real en sistemas objetivo y cuentas de prueba, sin bloqueos críticos; documentación y paquete correspondiente al commit verificado | Pendiente |

## Plataformas a investigar e implementar

Steam, Epic Games, GOG, Xbox/Microsoft Store, EA app, Ubisoft Connect, Battle.net, Riot Games, Rockstar Games, Amazon Games, itch.io y Humble Bundle. Evaluar también otros proveedores con interfaces mantenidas que aparezcan durante la investigación.

Para cada plataforma: separar detección local, consulta de biblioteca, autenticación, inicio/instalación mediante lanzador, metadatos y soporte de suscripciones. Si una capacidad no es viable, registrar la evidencia y ofrecer la capacidad local o importación explícita correspondiente; no presentar ese sustituto como conexión de cuenta terminada.

## Secuencia de trabajo

1. Persistencia recuperable y unión no destructiva de fuentes, contratos y fixtures de proveedores.
2. Integraciones de cuentas y estado visible de sincronización, empezando por flujos verificables; ampliar proveedor por proveedor.
3. Detección, resolución de identidades, organización y tratamiento de instalaciones/ediciones/licencias.
4. Onboarding completo, recuperación de datos, caché, privacidad, accesibilidad y diagnóstico.
5. Paquete de distribución, actualización, pruebas externas y auditoría contra todos los requisitos anteriores.

Las etapas pueden solaparse. La terminación se evalúa contra el objetivo completo, no contra la última etapa implementada.

## Investigación inicial — 7 de septiembre de 2026

- Steam documenta `GetOwnedGames`, sujeto a visibilidad y clave de API: https://partner.steamgames.com/doc/webapi/IPlayerService. Un login OpenID identifica al usuario y no debe confundirse con autorización universal para leer datos privados.
- Términos de Steam Web API: https://steamcommunity.com/dev/apiterms.
- Heroic demuestra integración de Epic, GOG y Amazon mediante Legendary, gogdl y Nile: https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher. Su existencia no certifica permisos, compatibilidad de licencias ni funcionamiento en Orbit.
- Referencia de integraciones de bibliotecas: https://github.com/JosefNemec/PlayniteExtensions. Investigar capacidades y condiciones antes de elegir una implementación; no copiar código o credenciales de otros clientes sin analizar su uso permitido.

## Registro de avance

- `e9883d5`: aislamiento de Next, onboarding de carpetas, búsqueda acotada y confirmación de ejecutables. 14 pruebas y recorrido de escritorio en un equipo. No es un candidato público completo.
- Siguiente incremento: unión de catálogo remoto con instalaciones y preferencias, recuperación desde respaldo aun si falta el archivo principal y conector Steam experimental en Ajustes. 21 pruebas automatizadas pasan; la autenticación real, persistencia de sesión, revocación y compatibilidad Windows 10 siguen pendientes. No se cuenta todavía como soporte de Steam validado.
- El conector Steam usa como referencia Playnite Extensions MIT, commit `3085ebd8b5906b53d3f005ef08141d641f4c469d`; el aviso se incluye en `THIRD_PARTY_NOTICES.md` y en el paquete.
- Conector GOG experimental: sesión web propia, consulta paginada con comprobación de integridad y descarte de tokens no necesarios. Login real y correspondencia con instalaciones locales todavía por validar. Misma referencia MIT de Playnite Extensions.
- Detección continua de candidatos en carpetas adicionales, con aviso y confirmación; disponibilidad de ejecutables manuales distingue archivo ausente de unidad inaccesible. 25 pruebas pasan y el recorrido de escritorio confirma que un nuevo ejecutable se propone sin incorporarse automáticamente.
- Epic: lector paginado de catálogo implementado y probado con respuestas controladas, conserva identidad compuesta compatible con manifiestos locales. El inicio de sesión, intercambio y renovación de autorización aún no están integrados: no se ofrece un botón de conexión incompleto.
- Almacén de credenciales con `safeStorage` de Electron: verificación real en este Windows de cifrado en disco, escrituras ordenadas, recuperación tras reiniciar y eliminación. Falla si el cifrado no está disponible. Usa datos ficticios de QA; aún no almacena sesiones de proveedores. La protección de Windows corresponde al usuario del sistema, no a una barrera contra otras aplicaciones ejecutadas por ese mismo usuario: https://www.electronjs.org/docs/latest/api/safe-storage.
- Estado de verificación del incremento Epic: 27 pruebas unitarias y `node scripts/qa-vault.cjs` pasan. No acredita autenticación de Epic, cuentas reales ni Windows 10.
- Epic integrado de extremo a extremo en código: ventana aislada, intercambio de autorización, renovación y almacén cifrado. `qa-epic.cjs` valida conexión, renovación, catálogo, ausencia de secretos en IPC y eliminación al desconectar, con respuestas de proveedor controladas. 30 pruebas unitarias pasan. La validación con la web y cuenta reales sigue pendiente, incluida la compatibilidad CAPTCHA/2FA. Usa el cliente público de compatibilidad del lanzador de la referencia comunitaria; la licencia MIT del código no acredita por sí sola los términos de acceso del proveedor para distribución pública (requisito RIGHTS pendiente).
- El onboarding incluye un tercer paso de cuentas opcionales. Permite completar la configuración sin iniciar sesión; las conexiones realizadas se conservan al volver a pasos anteriores.
- `0.2.0-alpha.2`: paquete local independiente en `release-next/alpha2/win-unpacked`. El recorrido de escritorio pasó desde el código y desde este ejecutable, incluidos los tres pasos del asistente sin conectar cuentas, portadas tras reiniciar y candidatos nuevos. No sustituye al paquete anterior de Next ni al Orbit instalado; sin firma y sin validación de cuentas reales.
- Posterior a alfa 2 (código): juegos manuales y lanzadores propios admiten argumentos separados y carpeta de trabajo. Ejecutables iniciados sin shell; un programa de prueba confirma argumentos literales y directorio efectivo. Variantes que comparten ejecutable conservan identidades y configuraciones diferentes, incluidas diferencias de mayúsculas en argumentos. 33 pruebas y recorrido de escritorio desde código pasan, con edición y persistencia tras reiniciar. Pendiente incorporar al siguiente paquete.
- Humble Bundle experimental (código posterior a alfa 2): lee referencias de pedidos desde una sesión web propia; consulta por lotes, descarta códigos de canje y datos privados, distingue descargas Windows de referencias de claves para tiendas admitidas. No verifica canje, suscripciones/Trove, identidad estable de la cuenta ni titularidad de claves fuera de Humble. La identidad se limita a la sesión local y se declara como no verificada. Pedidos ausentes o nulos fallan sin borrar la biblioteca. 35 pruebas y `qa-humble.cjs` pasan con respuestas controladas; pendiente login real, cobertura de más tipos de contenido y siguiente paquete. GOG y Humble ofrecen acceso explícito a la biblioteca web desde juegos sin instalación.
- Cancelación de cuentas: señal de aborto desde IPC hasta la ventana de autenticación y las solicitudes de Steam/GOG/Epic/Humble. Se descartan respuestas tardías antes de modificar la biblioteca; cancelar una sincronización conserva la cuenta y su estado previo. El guardado ya iniciado y la desconexión no se interrumpen. 38 pruebas pasan; `qa-epic.cjs` verifica cancelación durante una petición controlada de autorización y ausencia de cambios en la biblioteca. `qa-humble.cjs` continúa pasando.
