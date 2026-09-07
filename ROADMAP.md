# Orbit Games — Roadmap hasta la primera versión comercial

Fecha: 6 de septiembre de 2026.

Estado: MVP 1 iniciado en Orbit Games Next; Orbit Games 1.0.0 se conserva en main.

Base: aplicación local existente, instalador 1.0.0 y verificación en el equipo de desarrollo.

## Objetivo y criterio de producto terminado

Entregar una aplicación de Windows que permita reunir, organizar y abrir juegos de distintas plataformas con poca configuración, conservando la biblioteca del usuario entre sesiones y actualizaciones.

La primera versión comercial estará terminada cuando un usuario del público objetivo pueda instalarla, configurar su biblioteca, abrir juegos, actualizarla y obtener soporte sin asistencia del desarrollador, dentro de una compatibilidad publicada y comprobada. También deben estar resueltos los derechos del contenido utilizado, el canal de venta y la licencia del producto.

“Funciona para todo el mundo” no es un criterio comprobable. La propuesta inicial es **Windows 11 x64, procesadores Intel/AMD, interfaz en español**. La detección debe tolerar otras configuraciones regionales de Windows. Windows 10, ARM64, otros idiomas y otros sistemas operativos se incorporarán solo después de validarlos.

Los MVP son incrementos utilizables. Sus números no son versiones del paquete: la aplicación ya tiene versión técnica 1.0.0 y los nuevos paquetes deberán seguir una numeración creciente. Marcar una tarea como terminada requiere evidencia, no solo código escrito.

## Punto de partida

| Área | Estado conocido | Límite actual |
|---|---|---|
| Escritorio e instalación | Electron empaquetado; instalador NSIS por usuario | Instalador sin firma comercial; comprobado en un equipo |
| Biblioteca | Búsqueda, filtros, favoritos, notas, imágenes y altas manuales | La experiencia de primer uso todavía debe generalizarse |
| Detección | Integraciones locales con Steam, Epic, EA, Xbox, Ubisoft, Riot y accesos | No se ha validado cada combinación de plataforma y equipo |
| Inicio de juegos | Ejecutable de prueba lanzado desde la interfaz; entrega al cargador Xbox observada | No se ha confirmado el acceso al menú de todos los juegos; el caso Xbox necesita completar esa comprobación |
| Persistencia | Datos locales, escritura atómica, copia anterior y exportación de preferencias | Faltan migraciones entre versiones y respaldo completo desde la interfaz |
| Pruebas | 10 pruebas de dominio/persistencia y comprobaciones de escritorio aprobadas en la verificación existente | Parte de la prueba de escritorio depende de la biblioteca del desarrollador |
| Fichas e imágenes | Consultas públicas a Steam e imágenes personales | Condiciones de uso comercial pendientes; consultas fijadas a español/Argentina |
| Comercialización | Sin implementar | Sin actualizador, venta, activación ni publicación en Store |

Esta tabla describe la evidencia disponible al crear el roadmap; no equivale a certificación de compatibilidad general.

## Secuencia y dependencias

| Etapa | Entrega | Depende de | Estado |
|---|---|---|---|
| Preparación | Alcance, contenido autorizado y decisión técnica inicial de distribución | Base actual | Pendiente |
| MVP 1 | Primera experiencia autónoma | Preparación | En desarrollo, perfil Next independiente |
| MVP 2 | Biblioteca resistente a fallos y datos recuperables | MVP 1 | Pendiente |
| MVP 3 | Versión instalable y actualizable para beta | MVP 2 y decisión de canal | Pendiente |
| MVP 4 | Beta externa validada | MVP 3 | Pendiente |
| MVP 5 | Primera versión comercial | MVP 4 y decisión de venta | Pendiente |

La revisión del contenido y la prueba de MSIX pueden avanzar durante el MVP 1. Deben resolverse antes de distribuir la beta correspondiente. No conviene implementar simultáneamente dos sistemas completos de distribución y cobro para el primer lanzamiento.

## Preparación — Resolver las decisiones que pueden cambiar el producto

**Resultado:** alcance de la primera venta y viabilidad de distribución documentados.

- [ ] Definir el público inicial y su problema principal: personas que quieren organizar juegos locales con una configuración sencilla.
- [ ] Comparar el recorrido de primer uso con Playnite y formular una ventaja concreta de Orbit que se pueda comprobar con usuarios. La preferencia del creador no demuestra demanda comercial.
- [ ] Confirmar alcance inicial: Windows 11 x64, español y lista de integraciones que se intentarán certificar.
- [ ] Revisar condiciones de las fichas, imágenes, marcas y dependencias. Registrar proveedor, permiso aplicable, atribución y límites de almacenamiento/distribución.
- [ ] Si no se resuelve el permiso de una fuente, excluir esa integración de la distribución externa y usar recursos propios o autorizados hasta resolverlo. Una atribución por sí sola no demuestra permiso.
- [ ] Hacer una prueba pequeña de empaquetado MSIX: instalar, detectar juegos externos, iniciar un ejecutable, entregar el inicio a un lanzador, activar el inicio con Windows y conservar datos al actualizar.
- [ ] Decidir canal inicial: preferencia propuesta por Store con MSIX si supera la prueba; EXE web como alternativa si hay incompatibilidades relevantes.
- [ ] Revisar disponibilidad del nombre Orbit Games y de la identidad del editor antes de invertir en marca o registrar el producto.
- [x] Establecer control de versiones y registrar la base desde la que se trabaja, excluyendo bibliotecas personales, secretos y artefactos de prueba.

**Criterio de aceptación:** documento de decisiones con alcance, procedencia de contenido y resultado de la prueba MSIX. Cada impedimento tiene una resolución o un alcance reducido explícito. No se da por aprobada la publicación comercial.

## MVP 1 — Un usuario nuevo puede empezar solo

**Resultado:** instalar Orbit en un perfil vacío, configurar la biblioteca y abrir un juego sin instrucciones del desarrollador.

- [x] Crear una bienvenida breve: detectar plataformas, seleccionar carpetas y elegir si consultar fichas en línea, explicando qué servicio se utiliza.
- [x] No exigir la carpeta `Games` del escritorio ni rutas del equipo de desarrollo.
- [ ] Presentar estados útiles para biblioteca vacía, carpeta inexistente, lanzador ausente y falta de conexión.
- [ ] Mantener siempre disponible el alta manual de ejecutables y accesos compatibles.
- [ ] Detectar región e idioma o permitir elegirlos; eliminar la región argentina fijada en las consultas. Esto no obliga a traducir toda la interfaz en este MVP.
- [ ] Revisar el recorrido con teclado y el escalado de Windows a 100 %, 150 % y 200 % en las pantallas objetivo.
- [x] Sustituir dependencias de la biblioteca personal en las pruebas de escritorio por datos de prueba controlados.

**Criterios de aceptación:**

- Instalación y uso desde un usuario estándar sin Node.js ni herramientas de desarrollo.
- En un perfil sin datos previos se puede detectar o agregar un juego, abrirlo, marcarlo como favorito y conservarlo al reiniciar Orbit.
- La ausencia de lanzadores o de Internet no impide abrir la aplicación ni usar funciones locales.
- La interfaz permite completar el recorrido en las resoluciones y escalados publicados, sin controles inaccesibles.

**Evidencia:** grabación o capturas del recorrido, casos ejecutados y paquete identificado por versión y hash.

## MVP 2 — La biblioteca soporta errores y conserva los datos

**Resultado:** fallos de una plataforma, disco o servicio de fichas no inutilizan toda la biblioteca.

- [ ] Separar los fallos de detección por origen y mostrar qué parte no se pudo comprobar.
- [ ] Tratar un disco desconectado o un permiso denegado como evidencia insuficiente; evitar borrar entradas o afirmar que el juego fue desinstalado.
- [ ] Resolver rutas con espacios, tildes, nombres de usuario distintos y escritorios redirigidos a OneDrive.
- [ ] Gestionar tiempos límite y ejecución restringida de PowerShell con un mensaje útil y alternativa manual. No solicitar que se desactive la seguridad de Windows.
- [ ] Conservar la distinción entre “inicio solicitado” y juego realmente abierto; validar por separado lanzador, autenticación y llegada al menú.
- [ ] Añadir caché y reintentos limitados con espera creciente para la fuente de metadatos autorizada; tolerar respuestas incompletas y límites de solicitudes.
- [ ] Implementar migraciones de datos y respaldo/restauración completos de biblioteca, preferencias e imágenes personales, con tratamiento de rutas que cambian de equipo.
- [ ] Incorporar un diagnóstico exportable y revisable por el usuario, ocultando rutas personales e información sensible por defecto.
- [ ] Revisar las superficies de entrada: accesos, protocolos, respuestas remotas, imágenes y archivos de respaldo. Conservar aislamiento del renderer y validación de IPC.
- [ ] Medir arranque, búsqueda, memoria y escaneo con bibliotecas de 100, 500 y 1.000 entradas. Registrar el equipo de referencia y fijar límites de aceptación antes de la beta.

**Criterios de aceptación:**

- Una plataforma que falla no bloquea las demás ni elimina favoritos, notas o correcciones manuales.
- Los casos de disco ausente, acceso eliminado, ficha inaccesible y archivo de datos dañado producen resultados recuperables.
- Un respaldo completo se restaura en otro perfil; las rutas no disponibles quedan identificadas para corregirlas.
- La migración desde el formato actual preserva todos los datos cubiertos por los casos de prueba.
- No hay fallos abiertos que provoquen pérdida de datos, ejecución de destinos no autorizados o imposibilidad de usar la biblioteca.

**Evidencia:** pruebas automatizadas independientes del equipo, matriz de fallos y mediciones de rendimiento. Mantener el almacenamiento actual si satisface estos requisitos; no cambiar a una base de datos sin una necesidad demostrada.

## MVP 3 — Distribución y actualizaciones para una beta

**Resultado:** un paquete que pueda instalarse, actualizarse y desinstalarse con un comportamiento predecible.

### Trabajo común

- [ ] Fijar nombre, identidad de aplicación/editor y esquema de versiones antes de distribuir nuevos paquetes.
- [ ] Crear un proceso repetible de compilación, pruebas y empaquetado con dependencias fijadas y registro de los artefactos generados.
- [ ] Verificar que el paquete no incluya datos de juegos del desarrollador, perfiles de prueba, credenciales ni secretos.
- [ ] Probar instalación limpia, actualización desde la versión anterior, reinstalación, aplicación abierta durante la actualización y recuperación ante un fallo de instalación.
- [ ] Definir conservación/eliminación de datos al desinstalar según el canal, comunicarla y comprobarla.
- [ ] Preparar notas de versión, instrucciones breves de soporte y documentación de privacidad/licencias acorde al funcionamiento real.

### Si se elige Microsoft Store con MSIX

- [ ] Preparar la cuenta de desarrollador y la identidad del producto; completar los pasos que requieran al titular.
- [ ] Resolver el manifiesto y las integraciones de escritorio, especialmente inicio con Windows, lectura del inventario y ejecución de juegos externos.
- [ ] Usar el mecanismo de actualización de la tienda y comprobar una actualización real de la distribución de prueba elegida.
- [ ] Validar dónde se guardan los datos y cómo se conserva o importa la biblioteca de la instalación NSIS existente, sin duplicar las instalaciones accidentalmente.
- [ ] Ejecutar las comprobaciones de certificación aplicables y resolver sus incidencias.

### Si se elige instalador EXE por web

- [ ] Obtener una firma de código válida y firmar los componentes correspondientes; comprobar firma e identidad del editor.
- [ ] Publicar artefactos versionados e inmutables mediante HTTPS en el alojamiento autorizado para la beta.
- [ ] Implementar actualización con verificación de autenticidad/integridad, aviso claro y conservación de la biblioteca.
- [ ] Probar pérdida de conexión, descarga dañada y actualización no disponible. La versión instalada debe seguir siendo utilizable.
- [ ] Documentar que la firma no garantiza la ausencia de todos los avisos iniciales de SmartScreen.

**Criterio de aceptación:** dos versiones consecutivas del canal elegido se instalan y actualizan en equipos limpios conservando biblioteca y preferencias. La fuente del paquete es verificable y un fallo del actualizador no destruye los datos ni obliga a reinstalar para usar la versión anterior.

**Evidencia:** paquetes, hashes, comprobación de firma cuando corresponda, registro de actualización y resultado de restauración. Si la distribución privada de prueba exige una firma o configuración distinta a la Store final, debe quedar documentada; no se usará como instrucción general desactivar protecciones del sistema.

## MVP 4 — Beta externa y validación de la propuesta

**Resultado:** comprobar que Orbit sirve fuera del equipo de desarrollo y que su propuesta interesa al público objetivo.

Los siguientes tamaños y umbrales son **objetivos propuestos**, no resultados obtenidos ni garantía estadística de compatibilidad universal.

- [ ] Reclutar, con autorización del titular, entre 10 y 15 participantes en equipos distintos al de desarrollo. No enviar mensajes ni instaladores a terceros sin esa autorización.
- [ ] Cubrir varios usuarios estándar, Intel/AMD, distintas unidades de instalación y una selección real de plataformas anunciadas.
- [ ] Entregar instrucciones de uso normales; registrar dónde cada participante necesita ayuda.
- [ ] Completar una semana de uso y al menos una actualización de beta.
- [ ] Registrar fallos con versión, entorno, pasos, impacto y resultado esperado, evitando recopilar bibliotecas personales completas sin necesidad.
- [ ] Preguntar qué problema les resuelve frente a su forma habitual de abrir juegos y si pagarían por una propuesta y precio concretos. No tratar una intención declarada como una venta confirmada.
- [ ] Clasificar incidencias: bloqueante, alta, media y baja. Un fallo de una integración anunciada que impida abrir juegos requiere corrección o retirada explícita de ese soporte.
- [ ] Reducir alcance cuando una integración no alcance la fiabilidad necesaria; no ocultar la limitación.

**Criterios de aceptación propuestos:**

- Al menos 10 participantes completan el recorrido principal; al menos el 80 % lo hace sin ayuda del desarrollador en cinco minutos, excluyendo descargas de juegos y autenticación externa.
- Cero incidencias abiertas de pérdida de datos, seguridad o instalación/actualización bloqueada en la matriz compatible.
- Cada plataforma anunciada tiene una comprobación real de apertura hasta el menú de un juego representativo. Eso no implica compatibilidad con todos sus títulos.
- Las incidencias de prioridad alta están resueltas y verificadas, o el alcance afectado se retira de la oferta antes del lanzamiento.
- Existe evidencia de una ventaja valorada por varios participantes, además de la apariencia. Si no aparece, se revisa la propuesta o el modelo de venta antes de construir más funciones.

**Evidencia:** informe de beta, matriz de compatibilidad publicada, lista de incidencias y decisión argumentada de avanzar, repetir la beta o reducir alcance.

## MVP 5 — Primera versión comercial

**Resultado:** una persona puede conocer el producto, comprarlo, usarlo, actualizarlo y pedir ayuda mediante un canal definido.

- [ ] Elegir precio, modalidad y alcance de la compra. Propuesta inicial: pago único; decidir expresamente si incluye futuras versiones mayores y qué mantenimiento se ofrece.
- [ ] Definir prueba gratuita o demostración solo si facilita la evaluación del producto sin duplicar el desarrollo.
- [ ] Completar identidad comercial y configuración de cobros, reembolsos y datos fiscales que requiera el canal elegido.
- [ ] Implementar la licencia correspondiente al canal. Para web: definir dispositivos permitidos, recuperación tras reinstalación y uso sin conexión antes de programar la activación.
- [ ] No guardar secretos de cobro o proveedores en Electron. Añadir un servicio mínimo solo si el proveedor o la validación de licencias lo requiere.
- [ ] Verificar compra/activación, reinstalación, fallo de red, recuperación de licencia y reembolso con las herramientas de prueba disponibles; una operación con dinero real exige autorización específica.
- [ ] Preparar la ficha comercial y una web breve si aporta valor: capturas reales, sistemas compatibles, funciones, limitaciones, precio, privacidad y soporte.
- [ ] Mantener explícito que Orbit no incluye juegos, no evita sus licencias y no importa automáticamente todo el catálogo comprado de cada cuenta.
- [ ] Completar certificación de Store si ese es el canal elegido; no anunciar disponibilidad antes de la aprobación efectiva.
- [ ] Definir un procedimiento de soporte, gestión de incidencias y retirada de una versión defectuosa. Publicar una corrección con versión superior cuando el canal no permita retroceder.
- [ ] Presentar al titular el paquete final, condiciones de venta, ficha y costes conocidos para autorizar la publicación. Este roadmap no autoriza gastos ni publicación por sí mismo.
- [ ] Tras la autorización, publicar y comprobar el recorrido desde la descarga oficial hasta el primer uso.

**Criterio de aceptación:** recorrido comercial y técnico verificado en el canal real, licencia recuperable, actualización funcional, soporte disponible, contenido autorizado y ausencia de incidencias bloqueantes. El producto publicado coincide con lo anunciado.

**Evidencia:** versión y hash publicados, enlace oficial, resultado de certificación si aplica y comprobaciones de instalación, licencia y actualización sin exponer datos de pago.

## Fuera de la primera versión comercial

Estas funciones solo entran si la beta demuestra que son necesarias para la propuesta de valor; añadirlas por comparación con un competidor puede retrasar la salida sin mejorar las ventas.

- Sincronización de biblioteca en la nube y cuentas propias obligatorias.
- Importación de todas las compras mediante autenticación de cada plataforma.
- macOS, Linux y soporte ARM64 sin validación específica.
- Emuladores, tienda de plugins y temas creados por terceros.
- Funciones sociales, recomendaciones con IA y logros unificados.
- Modo consola completo con mando y seguimiento avanzado de tiempo de juego.
- Descargas de juegos, gestión de sus instalaciones o modificaciones de sus archivos.
- Aplicación móvil y suscripción sin un servicio recurrente definido.

## Cómo ejecutar y mantener el roadmap

Trabajar en un MVP por vez y conservar una versión utilizable al cerrar cada etapa. Dividir las tareas grandes en cambios revisables. Actualizar las casillas solo al reunir la evidencia indicada y registrar qué versión la produjo.

No se fijan fechas todavía: los permisos del contenido, la prueba MSIX y la beta externa pueden cambiar el alcance. Después de la preparación se estiman los MVP 1–3 por tareas; la fecha comercial se revisa con los resultados de la beta y los plazos externos de certificación.

| Decisión pendiente | Propuesta de partida | Momento límite |
|---|---|---|
| Público y ventaja principal | Organización local sencilla y experiencia visual cuidada | Preparación; confirmar en MVP 4 |
| Sistemas e idiomas | Windows 11 x64, español | Preparación |
| Proveedor de fichas e imágenes | Fuente con condiciones comerciales comprobadas | Antes de distribuir contenido en beta |
| Canal inicial | Store MSIX si supera la prueba técnica | Antes de MVP 3 |
| Modelo y precio | Evaluar pago único con alcance de mantenimiento explícito | Validar en MVP 4; cerrar antes de MVP 5 |
| Presupuesto externo | Solo servicios necesarios para el canal elegido | Antes de contratar firma, alojamiento o proveedores |

Para cerrar cada MVP, registrar: fecha, versión, tareas completadas, pruebas/evidencia, limitaciones restantes y decisión de avanzar. Las métricas propuestas se pueden ajustar antes de la prueba, justificando el cambio; no después para ocultar un resultado desfavorable.

## Referencias para las decisiones de distribución y contenido

Referencias revisadas durante la evaluación del 6 de septiembre de 2026. Revalidar los requisitos y condiciones antes de contratar o publicar.

- Microsoft: [comparación de canales de distribución](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path). Distingue actualizaciones y firma gestionadas por Store para MSIX frente a las responsabilidades del editor con EXE.
- Microsoft: [requisitos para instaladores EXE/MSI en Store](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements). Incluyen firma, URL HTTPS versionada e instalación silenciosa.
- Microsoft: [empaquetado de Electron](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/electron-packaging) y [opciones de firma](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).
- Microsoft: [políticas de la tienda](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) y [opciones de precio para EXE/MSI](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/set-app-pricing). No asumir que subir un EXE proporciona el mismo cobro inicial o gestión de licencias que cualquier otra modalidad.
- Valve: [condiciones de Steam Web API](https://steamcommunity.com/dev/apiterms). La implementación actual consulta endpoints de la tienda; estas condiciones no prueban por sí solas el permiso comercial de todas las imágenes o de esos endpoints.
- IGDB: [documentación y distinción de uso comercial](https://api-docs.igdb.com/).
- Playnite: [funciones y disponibilidad gratuita](https://www.playnite.link/), como referencia para validar la propuesta de Orbit.
