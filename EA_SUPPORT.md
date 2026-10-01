# EA app: integración en desarrollo

Revisión: 01/10/2026. La conexión de cuenta está habilitada como experimental en el código posterior a alfa 5; no incluida en ese instalador. La detección local existente continúa disponible.

## Referencia actual

Se revisó el conector comunitario de Jeshibu, versión declarada 3.2.2, en el commit `959ef2e12be8308186356402b69061f57a6252ac` de [PlayniteExtensions](https://github.com/Jeshibu/PlayniteExtensions/tree/959ef2e12be8308186356402b69061f57a6252ac/source/EaLibrary).

Su [EaWebsite.cs](https://github.com/Jeshibu/PlayniteExtensions/blob/959ef2e12be8308186356402b69061f57a6252ac/source/EaLibrary/Services/EaWebsite.cs) usa inicio web de EA y consultas GraphQL a `service-aggregation-layer.juno.ea.com`. El catálogo `getPreloadedOwnedGames` filtra PC, juegos completos y varios métodos de adquisición, incluidas suscripciones y asociaciones Steam/Epic. La autenticación obtiene autorización de solicitudes realizadas dentro de su navegador; no usa un servidor propio en ese flujo. Esto describe el código de referencia, no una autenticación verificada de Orbit ni autorización contractual para distribución.

## Implementado en Orbit

`electron/accounts/ea-catalog.cjs` interpreta páginas mediante un transporte inyectado. Comprueba identidad de cuenta, recuentos, cursores repetidos, duplicados y errores GraphQL incluso si acompañan datos. Limita a 500 elementos por página, 10.000 registros y 100 páginas. Una importación incompleta no produce un resultado parcial.

Devuelve únicamente identidad de cuenta, identificador de oferta, nombre y nota de acceso. Excluye lanzadores y productos explícitamente ajenos a PC. Pruebas y suscripciones reciben notas propias; el acceso permanece sin verificar. No devuelve identificadores de entitlement, métodos crudos ni respuestas originales. Los códigos de oferta necesitan validación real antes de usarse para unir instalaciones o lanzar juegos.

Pruebas sintéticas: paginación completa/vacía, truncamiento, datos con errores, cambio de cuenta, cambio de total, bucles, duplicados, filtrado y cancelación. No se accedió a sesiones ni credenciales reales. El proveedor está registrado y se ofrece desde Ajustes y el panel de cuentas del asistente.

## Transporte implementado

`ea-transport.cjs` construye la consulta persistida de la referencia fijada, con destino exclusivo al host GraphQL de EA. Envía el bearer solo en el encabezado; no lo incluye en URLs, resultados ni mensajes de error. Omite cookies y caché y rechaza redirecciones. Cada página tiene un límite de 8 MiB y 20 segundos; cancelación y timeout interrumpen también lectores que no cooperan y cancelan su cuerpo. Distingue rechazo de sesión, límite de consultas y caída del servicio sin divulgar sus respuestas.

`fetchEaCatalog` conecta ese transporte al lector paginado. La autorización la aporta el adaptador de sesión; el transporte no inicia el login por sí solo. QA sintética en `ea-transport.test.cjs`; no demuestra que la consulta persistida siga aceptada por EA con una cuenta real.

## Captura de autorización preparada

`ea-authorization.cjs` observa únicamente el endpoint GraphQL HTTPS exacto y el identificador de la ventana de autenticación propietaria. Excluye credenciales en URL, puertos alternativos, otros paths y encabezados ambiguos; conserva solo un bearer acotado en memoria. Cancelar o disponer el observador borra esa referencia y desregistra el listener. Se rechaza un segundo observador sobre la misma sesión para evitar que sustituya al primero.

El adaptador `ea.cjs` conecta la captura al contrato `prepareSession` de `auth-window.cjs`. La ventana crea una señal propia y cancela lecturas y dispone el contexto al cerrar, terminar o fallar. El adaptador está registrado como conexión experimental. La captura no acredita identidad: deberá consultarse y comprobarse la cuenta de EA antes de persistir la conexión. Pruebas sintéticas en `ea-authorization.test.cjs`; no se inspeccionaron cookies ni autorizaciones reales.

## Adaptador y ciclo de vida

`ea.cjs` prepara la captura para una ventana propia, consulta el catálogo con el bearer y devuelve identidad y catálogo validados, sin devolver el bearer al servicio de cuentas. Tras volver a la página inicial de EA navega una sola vez a la página de ofertas usada por la referencia. Los hosts de navegación son explícitos; su cobertura de login real, región y segundo factor aún debe comprobarse.

`qa-auth-lifecycle.cjs` verifica con ventanas Electron y respuestas locales que éxito y cierre cancelan la señal, disponen el contexto una sola vez y mantienen Node y preload deshabilitados. `qa-battlenet.cjs` sigue pasando. Estas pruebas no ejercitan el sitio real de EA. La captura con tráfico HTTPS controlado se verifica por separado a continuación.

## Captura verificada con tráfico Electron

`node scripts/qa-ea-session.cjs` arranca un servidor HTTPS en loopback con certificado efímero generado mediante OpenSSL. Una instancia Electron de QA resuelve todos los hosts al servidor local y permite ese certificado solo mediante argumentos de ese proceso de prueba; la aplicación distribuida no incorpora esos argumentos.

El recorrido navega desde login a inicio y ofertas, emite una solicitud del renderer con autorización sintética y ejecuta la consulta del catálogo desde el proceso principal. Se comprueban identidad, catálogo con un juego y ausencia del bearer en el resultado. La suite unitaria también cubre el catálogo vacío. El servidor rechaza solicitudes de catálogo sin el bearer de la prueba. El perfil es exclusivo bajo la carpeta QA de Next.

Resultado: aprobado. La sustitución previa del protocolo HTTPS no emitía el evento `onBeforeSendHeaders`; por eso no sirve para comprobar este mecanismo. El servidor local sí ejercita la pila de red de Electron. Se amplió el recorrido al servicio de cuentas: importa un juego, rechaza catálogo truncado y cambio de identidad sin alterar los juegos, sincroniza, desconecta y recarga el almacén conservando notas y favoritos. Verifica también el botón Conectar EA app de Ajustes. Esto no prueba el login real, segundo factor ni expiración de sesión del proveedor.

## Enlaces locales de EA

`ea-uri.cjs` reconoce `origin2://game/launch/?offerIds=<contenido>` y los enlaces heredados `origin[2]://launchgame/<id>`, incluidos identificadores con puntos. El formato actual se contrastó con `ActionControllers/EaControllerHelper.cs` de la referencia fijada: usa `legacyOffer.contentId`, que no debe equipararse directamente a `originOfferId` del catálogo.

Los accesos guardan `eaLaunchId` separado de `providerId`. Un enlace no acredita instalación: conserva estado sin verificar. Accesos del mismo título con distintos identificadores de contenido no se combinan por nombre. La consulta de correspondencias conecta ahora el `contentId` del acceso con el `offerId` remoto solo cuando EA devuelve una correspondencia completa y única. La importación cuenta-primero y el escaneo local-primero conservan el ID del registro y sus datos personales, artwork y evidencia de lanzamiento. Si falta el mapa o es ambiguo, los registros permanecen separados; la sincronización EA elimina del registro remoto el mapa anterior del producto cuando la respuesta actual no contiene uno. También se bloquea la combinación por título cuando solo uno de los registros dispone de identificador de oferta: se reprodujo una asociación incorrecta al importar primero la cuenta y luego detectar un juego local homónimo. No se reparan automáticamente asociaciones históricas. La biblioteca del lanzador usa ahora `origin2://library/open`, como la referencia; su apertura real en EA app sigue pendiente de prueba.

Evidencia: `ea-uri.test.cjs`, detección de acceso controlado, rechazo de enlaces ambiguos y 115/115 pruebas de regresión aprobadas, incluida la reproducción del fallo antes de aplicar la corrección.

## Lector de correspondencias

`ea-offers.cjs` interpreta `data.legacyOffers` de la consulta `getLegacyCatalogDefs` documentada en el código de referencia. Guarda exclusivamente `offerId` y `contentId`; descarta rutas, parámetros, directivas de registro y otros campos. Exige que cada lote devuelva exactamente sus ofertas solicitadas, sin errores GraphQL ni duplicados.

El coordinador procesa hasta 10.000 ofertas, en lotes de 100 y con cancelación. Si dos ofertas comparten contenido, esa correspondencia queda excluida aunque la colisión aparezca en otro lote. Un contenido nulo no se sustituye por el identificador de oferta. Un lote incompleto impide devolver un mapa parcial.

Pruebas en `ea-offers.test.cjs`: selección de campos, lotes incompletos, contenido ausente, ambigüedad entre lotes y cancelación. El lector está conectado al transporte HTTP mediante `fetchEaOfferMapping` y su resultado alimenta la combinación de registros. No modifica bibliotecas si un lote falla o la operación se cancela.

## Transporte de correspondencias

`fetchEaOfferMapping` envía `getLegacyCatalogDefs` por POST al host fijo de EA. La consulta selecciona solo `offerId: id` y `contentId`. Sigue el flujo sin bearer de la referencia, con cookies omitidas; reutiliza el lector HTTP acotado a 8 MiB/20 segundos, rechazo de redirecciones, cancelación y errores neutralizados. En el adaptador, los juegos del catálogo reciben `eaContentId` solo para ofertas incluidas en el resultado validado.

Prueba controlada con 101 ofertas verifica dos lotes, contrato POST, ausencia de autorización y rechazo de lote incompleto. No se consultó el servicio real de EA.

## Unión de registros

`ea-identity.cjs` usa solo pares únicos `offerId`/`contentId`. Permite unir la entrada local y la de cuenta tanto si se importa primero la cuenta como si se detecta primero el acceso local; el nombre localizado no participa en la identidad. Los cambios conservan el ID existente, notas, favoritos, etiquetas, personalización, artwork, estado local y datos de lanzamiento. Los accesos de cuenta mantienen ownership `unknown` hasta que exista evidencia que lo confirme; los enlaces locales mantienen instalación `unknown`.

Una correspondencia nula, ausente o ambigua no crea una unión nueva. Un mapa ausente en la actualización actual se elimina del registro remoto para el producto sincronizado, por lo que esa respuesta no puede aportar una asociación posterior. Los registros manuales y duplicados históricos no se fusionan automáticamente. Una sincronización de otra plataforma no modifica identidades EA separadas.

Evidencia al 01/10/2026: `npm test`, 124/124 pruebas; `node scripts/qa-ea-session.cjs`, aprobado con `success:true`, `controlledElectronTraffic:true`, `persistedAccountLifecycle:true`, `settingsConnectButton:true`, `complete:true`, `count:1` y `containsBearer:false`. La QA usa un servicio HTTPS en loopback y tráfico sintético; no valida autenticación, mapa, ownership, instalación ni lanzamiento contra EA real. ACC-08 sigue abierto.

## Trabajo siguiente

- Validar el inicio de sesión real en una sesión exclusiva de Orbit, incluidos vencimiento, renovación, segundo factor y cambio de cuenta.
- Confirmar la consulta actual con una cuenta autorizada: biblioteca vacía, ediciones, pruebas, suscripciones y títulos asociados a otras tiendas.
- Validar la correspondencia y los accesos locales con una cuenta autorizada; probar el lanzamiento y apertura de biblioteca en EA app.
- Revisar la UI, desconexión, diagnóstico y requisitos de distribución con una cuenta real y una compilación candidata. La QA sintética no cubre esos casos.

No se necesita decidir un servidor propio para el lector implementado. La viabilidad integral sigue pendiente de autenticación y verificación real.
