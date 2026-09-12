# Battle.net: cobertura y validación pendiente

El código posterior a alfa 4 detecta entradas de Blizzard en el inventario del registro de Windows cuando incluyen nombre, identificador de registro, carpeta absoluta y un icono que apunta a un ejecutable dentro de esa carpeta. Excluye lanzadores, agentes, instaladores y rutas exteriores. La presencia del archivo permite indicar instalación local; una unidad inaccesible queda sin verificar.

Los accesos simples al mismo ejecutable se incorporan como fuente de esa entrada. Los accesos con argumentos se mantienen para su interpretación habitual, porque pueden representar otro modo de ejecución. Encontrar solo `Battle.net.exe` o `Battle.net Launcher.exe` no confirma una instalación del juego.

La ruta de inicio de una entrada del registro es el ejecutable identificado. Si hay un acceso simple asociado, se prefiere ese acceso para conservar sus opciones de Windows. No acredita que cada juego pueda iniciarse sin pasar por el cliente; las variantes que requieran parámetros o autenticación deben verificarse y pueden configurarse mediante su acceso directo. No se ejecutan juegos durante la detección.

## Pendientes

En el código posterior a alfa 5 existe un lector de catálogo en `electron/accounts/battlenet-catalog.cjs`, todavía sin registrar como conector. Consulta `games-and-subs` y `classic-games` desde una sesión que deberá proporcionar el flujo de autenticación. Devuelve solo identificador de título, nombre y una indicación de acceso no verificado; no conserva nombres de cuentas de juego, regiones, estados privados ni claves. No interpreta la existencia de una cuenta de juego como compra o suscripción vigente.

El lector exige ambas respuestas completas. Si aparecen juegos clásicos, rechaza la importación hasta contar con una correspondencia fiable de sus ediciones; no devuelve una biblioteca parcial como completa. Esto limita su utilidad actual y debe resolverse antes de considerar cubierta la integración. Tres pruebas con respuestas controladas verifican esa condición, errores, tamaño máximo y cancelación. No hay botón de conexión habilitado ni validación con cuenta real.

- Leer `product.db` con un formato acotado y cobertura de identidades verificada. Algunos juegos pueden no registrar una entrada de desinstalación.
- Relacionar instalaciones con IDs del catálogo remoto, conservando versiones, pruebas y regiones.
- Conexión de cuenta, renovación y biblioteca de juegos sin instalar.
- Verificación con instalaciones reales en Windows 10 y 11, y lanzamiento explícito de títulos representativos.

## Fuentes y evidencia

La integración comunitaria de [Playnite, BattleNetLibrary.cs](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetLibrary.cs), consultada el 12 de septiembre de 2026, identifica entradas del registro y usa `product.db` como alternativa. Su [modelo de productos](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetGames.cs) documenta identificadores conocidos. Orbit no incorpora ese catálogo ni interpreta todavía la base protobuf.

Las pruebas de Orbit usan inventario controlado: rutas vecinas, iconos fuera de la instalación, componentes del cliente, entradas repetidas, estados de disponibilidad, cancelación y asociación de accesos. Esto no certifica cobertura real de todos los títulos Battle.net. No se leen sesiones ni credenciales del cliente.
