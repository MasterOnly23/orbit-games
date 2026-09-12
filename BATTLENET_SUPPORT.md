# Battle.net: cobertura y validación pendiente

El código posterior a alfa 4 detecta entradas de Blizzard en el inventario del registro de Windows cuando incluyen nombre, identificador de registro, carpeta absoluta y un icono que apunta a un ejecutable dentro de esa carpeta. Excluye lanzadores, agentes, instaladores y rutas exteriores. La presencia del archivo permite indicar instalación local; una unidad inaccesible queda sin verificar.

Los accesos simples al mismo ejecutable se incorporan como fuente de esa entrada. Los accesos con argumentos se mantienen para su interpretación habitual, porque pueden representar otro modo de ejecución. Encontrar solo `Battle.net.exe` o `Battle.net Launcher.exe` no confirma una instalación del juego.

La ruta de inicio de una entrada del registro es el ejecutable identificado. Si hay un acceso simple asociado, se prefiere ese acceso para conservar sus opciones de Windows. No acredita que cada juego pueda iniciarse sin pasar por el cliente; las variantes que requieran parámetros o autenticación deben verificarse y pueden configurarse mediante su acceso directo. No se ejecutan juegos durante la detección.

## Pendientes

- Leer `product.db` con un formato acotado y cobertura de identidades verificada. Algunos juegos pueden no registrar una entrada de desinstalación.
- Relacionar instalaciones con IDs del catálogo remoto, conservando versiones, pruebas y regiones.
- Conexión de cuenta, renovación y biblioteca de juegos sin instalar.
- Verificación con instalaciones reales en Windows 10 y 11, y lanzamiento explícito de títulos representativos.

## Fuentes y evidencia

La integración comunitaria de [Playnite, BattleNetLibrary.cs](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetLibrary.cs), consultada el 12 de septiembre de 2026, identifica entradas del registro y usa `product.db` como alternativa. Su [modelo de productos](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/BattleNetGames.cs) documenta identificadores conocidos. Orbit no incorpora ese catálogo ni interpreta todavía la base protobuf.

Las pruebas de Orbit usan inventario controlado: rutas vecinas, iconos fuera de la instalación, componentes del cliente, entradas repetidas, estados de disponibilidad, cancelación y asociación de accesos. Esto no certifica cobertura real de todos los títulos Battle.net. No se leen sesiones ni credenciales del cliente.
