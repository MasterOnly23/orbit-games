# EA app: integración en desarrollo

Revisión: 13/09/2026. La conexión de cuenta todavía no está habilitada en Orbit Next. La detección local existente continúa disponible.

## Referencia actual

Se revisó el conector comunitario de Jeshibu, versión declarada 3.2.2, en el commit `959ef2e12be8308186356402b69061f57a6252ac` de [PlayniteExtensions](https://github.com/Jeshibu/PlayniteExtensions/tree/959ef2e12be8308186356402b69061f57a6252ac/source/EaLibrary).

Su [EaWebsite.cs](https://github.com/Jeshibu/PlayniteExtensions/blob/959ef2e12be8308186356402b69061f57a6252ac/source/EaLibrary/Services/EaWebsite.cs) usa inicio web de EA y consultas GraphQL a `service-aggregation-layer.juno.ea.com`. El catálogo `getPreloadedOwnedGames` filtra PC, juegos completos y varios métodos de adquisición, incluidas suscripciones y asociaciones Steam/Epic. La autenticación obtiene autorización de solicitudes realizadas dentro de su navegador; no usa un servidor propio en ese flujo. Esto describe el código de referencia, no una autenticación verificada de Orbit ni autorización contractual para distribución.

## Implementado en Orbit

`electron/accounts/ea-catalog.cjs` interpreta páginas mediante un transporte inyectado. Comprueba identidad de cuenta, recuentos, cursores repetidos, duplicados y errores GraphQL incluso si acompañan datos. Limita a 500 elementos por página, 10.000 registros y 100 páginas. Una importación incompleta no produce un resultado parcial.

Devuelve únicamente identidad de cuenta, identificador de oferta, nombre y nota de acceso. Excluye lanzadores y productos explícitamente ajenos a PC. Pruebas y suscripciones reciben notas propias; el acceso permanece sin verificar. No devuelve identificadores de entitlement, métodos crudos ni respuestas originales. Los códigos de oferta necesitan validación real antes de usarse para unir instalaciones o lanzar juegos.

Pruebas sintéticas: paginación completa/vacía, truncamiento, datos con errores, cambio de cuenta, cambio de total, bucles, duplicados, filtrado y cancelación. No se accedió a sesiones ni credenciales reales. El módulo aún no está registrado como proveedor ni conectado a la interfaz.

## Transporte implementado

`ea-transport.cjs` construye la consulta persistida de la referencia fijada, con destino exclusivo al host GraphQL de EA. Envía el bearer solo en el encabezado; no lo incluye en URLs, resultados ni mensajes de error. Omite cookies y caché y rechaza redirecciones. Cada página tiene un límite de 8 MiB y 20 segundos; cancelación y timeout interrumpen también lectores que no cooperan y cancelan su cuerpo. Distingue rechazo de sesión, límite de consultas y caída del servicio sin divulgar sus respuestas.

`fetchEaCatalog` conecta ese transporte al lector paginado. Aún no obtiene tokens ni habilita un proveedor en la interfaz. QA sintética en `ea-transport.test.cjs`; no demuestra que la consulta persistida siga aceptada por EA con una cuenta real.

## Captura de autorización preparada

`ea-authorization.cjs` observa únicamente el endpoint GraphQL HTTPS exacto y el identificador de la ventana de autenticación propietaria. Excluye credenciales en URL, puertos alternativos, otros paths y encabezados ambiguos; conserva solo un bearer acotado en memoria. Cancelar o disponer el observador borra esa referencia y desregistra el listener. Se rechaza un segundo observador sobre la misma sesión para evitar que sustituya al primero.

El adaptador `ea.cjs` conecta la captura al contrato `prepareSession` de `auth-window.cjs`. La ventana crea una señal propia y cancela lecturas y dispone el contexto al cerrar, terminar o fallar. El adaptador todavía no se registra en la lista pública de proveedores. La captura no acredita identidad: deberá consultarse y comprobarse la cuenta de EA antes de persistir la conexión. Pruebas sintéticas en `ea-authorization.test.cjs`; no se inspeccionaron cookies ni autorizaciones reales.

## Adaptador y ciclo de vida

`ea.cjs` prepara la captura para una ventana propia, consulta el catálogo con el bearer y devuelve identidad y catálogo validados, sin devolver el bearer al servicio de cuentas. Tras volver a la página inicial de EA navega una sola vez a la página de ofertas usada por la referencia. Los hosts de navegación son explícitos; su cobertura de login real, región y segundo factor aún debe comprobarse.

`qa-auth-lifecycle.cjs` verifica con ventanas Electron y respuestas locales que éxito y cierre cancelan la señal, disponen el contexto una sola vez y mantienen Node y preload deshabilitados. `qa-battlenet.cjs` sigue pasando. Estas pruebas no ejercitan el sitio real de EA ni prueban todavía la captura a través de su tráfico real.

## Trabajo siguiente

- Autenticar el transporte con una sesión real autorizada: el transporte HTTP ya está implementado y probado con respuestas sintéticas.
- Autenticación en una sesión exclusiva de Orbit; expiración, renovación, segundo factor y cambio de cuenta.
- Comprobar la consulta vigente con una cuenta autorizada, incluyendo cuenta vacía, ediciones, pruebas, suscripciones y títulos asociados a otras tiendas.
- Verificar unión por oferta con instalaciones locales y acciones de EA app; no suponer que el nombre basta.
- Integrar UI, desconexión y diagnóstico; revisar requisitos de distribución y atribución.

No se necesita decidir un servidor propio para el lector implementado. La viabilidad integral sigue pendiente de autenticación y verificación real.
