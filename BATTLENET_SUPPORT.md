# Battle.net: cobertura y validación pendiente

El código posterior a alfa 4 detecta entradas de Blizzard en el inventario del registro de Windows cuando incluyen nombre, identificador de registro, carpeta absoluta y un icono que apunta a un ejecutable dentro de esa carpeta. Excluye lanzadores, agentes, instaladores y rutas exteriores. La presencia del archivo permite indicar instalación local; una unidad inaccesible queda sin verificar.

Los accesos simples al mismo ejecutable se incorporan como fuente de esa entrada. Los accesos con argumentos se mantienen para su interpretación habitual, porque pueden representar otro modo de ejecución. Encontrar solo `Battle.net.exe` o `Battle.net Launcher.exe` no confirma una instalación del juego.

La ruta de inicio de una entrada del registro es el ejecutable identificado. Si hay un acceso simple asociado, se prefiere ese acceso para conservar sus opciones de Windows. No acredita que cada juego pueda iniciarse sin pasar por el cliente; las variantes que requieran parámetros o autenticación deben verificarse y pueden configurarse mediante su acceso directo. No se ejecutan juegos durante la detección.

## Pendientes

Asociación local/remota posterior a alfa 5: el inventario lee la cadena de desinstalación solo como dato, sin ejecutarla. Un UID exacto de Battle.net se relaciona con un ID de título mediante la referencia de Playnite `3085ebd8b5906b53d3f005ef08141d641f4c469d`. Se excluyen IDs de API compartidos por varios UID (como auks/pinta), sufijos desconocidos y registros cuyo nombre indica prueba. Las pruebas comprueban importación local primero y cuenta primero con nombres distintos, conservando notas, etiquetas, identidad y acceso remoto. Resolver dos entradas ya duplicadas antes de este cambio sigue pendiente; no se aplica una fusión destructiva de historiales.

En el código posterior a alfa 5 existe un lector de catálogo en `electron/accounts/battlenet-catalog.cjs`, integrado con el conector experimental de sesión local. Consulta `games-and-subs` y `classic-games` desde una sesión web aislada de Orbit. Devuelve solo identificador de título, nombre y una indicación de acceso no verificado; no conserva nombres de cuentas de juego, regiones, estados privados ni claves. No interpreta la existencia de una cuenta de juego como compra o suscripción vigente.

El lector exige ambas respuestas completas. Si aparecen juegos clásicos, rechaza la importación hasta contar con una correspondencia fiable de sus ediciones; no devuelve una biblioteca parcial como completa. Esto limita su utilidad actual y debe resolverse antes de considerar cubierta la integración. Tres pruebas con respuestas controladas verifican esa condición, errores, tamaño máximo y cancelación. El código posterior a alfa 5 ofrece Conectar Battle.net con límites visibles. No hay validación con cuenta real.

- Leer `product.db` con un formato acotado y cobertura de identidades verificada. Algunos juegos pueden no registrar una entrada de desinstalación.
- Relacionar instalaciones con IDs del catálogo remoto, conservando versiones, pruebas y regiones.
- Verificación real del inicio de sesión, renovación, segundo factor y cambio de cuenta. La identidad actual se limita a la sesión local; no hay un identificador estable de cuenta verificado.
- Verificación con instalaciones reales en Windows 10 y 11, y lanzamiento explícito de títulos representativos.

## Fuentes y evidencia

La integración comunitaria de [Playnite, BattleNetLibrary.cs](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetLibrary.cs), consultada el 12 de septiembre de 2026, identifica entradas del registro y usa `product.db` como alternativa. Su [modelo de productos](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetGames.cs) documenta identificadores conocidos. Orbit no incorpora ese catálogo ni interpreta todavía la base protobuf.

Las pruebas de Orbit usan inventario controlado: rutas vecinas, iconos fuera de la instalación, componentes del cliente, entradas repetidas, estados de disponibilidad, cancelación y asociación de accesos. Esto no certifica cobertura real de todos los títulos Battle.net. No se leen sesiones ni credenciales del cliente.

## Sesión experimental posterior a alfa 5

El conector abre la ruta de autorización de ajustes de Battle.net en una ventana aislada sin preload de Orbit ni Node.js. La navegación se restringe a hosts explícitos de Battle.net; la sesión es propia de Orbit y no se lee la del lanzador instalado. Las consultas de estado solo devuelven autenticación y un nombre genérico. No acredita identidad estable ni permite detectar por sí sola un cambio de cuenta dentro de la misma sesión.

`node scripts/qa-battlenet.cjs` verifica con respuestas controladas: botón de conexión, restricciones de la ventana, importación con acceso desconocido, sincronización fallida con clásicos conservando juegos anteriores, reintento y desconexión. Comprueba ausencia de campos privados ficticios en la biblioteca persistida. No sustituye el login real ni valida CAPTCHA/2FA o condiciones de distribución.
