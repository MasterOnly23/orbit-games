# Orbit Games Next

Primera versión de desarrollo para configurar Orbit en otros equipos Windows. Esta rama conserva una identidad independiente de **Orbit Games 1.0.0**.

## Dos aplicaciones independientes

El conector de desarrollo para itch.io requiere registrar la aplicación OAuth de Orbit antes de activarlo. Consulta [configuración y límites](ITCH_SETUP.md). El registro corresponde al producto; no será una tarea para cada usuario. Todavía no se ha validado una cuenta real ni se ha incluido en alfa 2.

En el código posterior a alfa 2, **Ajustes → Exportar biblioteca** guarda juegos, rutas, opciones de lanzamiento, favoritos, notas, fichas y portadas locales en un JSON portable. **Restaurar** valida el archivo y muestra un resumen antes de agregar juegos o aplicar preferencias. Conserva los juegos ajenos a la copia y las rutas de las entradas ya existentes. Las nuevas entradas quedan sin verificar; revisa las rutas al cambiar de equipo. Las cuentas, sesiones y carpetas vigiladas actuales no se reemplazan. No incluye archivos de juegos ni descarga imágenes remotas. Admite las copias antiguas de preferencias para juegos existentes. Límites actuales: 10.000 juegos, 20 MiB por portada y 256 MiB por archivo. `node scripts/qa-backup.cjs` comprueba cancelación, restauración entre perfiles y portadas visibles tras reiniciar.

El primer lanzamiento público tiene como objetivo Windows 10 y Windows 11 x64. La compatibilidad pública todavía no está acreditada: consulta [la matriz de validación](WINDOWS_VALIDATION.md).

| Elemento | Orbit actual | Orbit Next |
|---|---|---|
| Rama | `main` | `feature/orbit-next-onboarding` |
| Nombre | Orbit Games | Orbit Games Next |
| Identificador | `com.pipe.orbitgames` | `com.pipe.orbitgames.next` |
| Biblioteca y caché | `%APPDATA%\Orbit Games` | `%APPDATA%\Orbit Games Next` |
| Salida de compilación | `release/` | `release-next/` |
| Inicio de Windows | Configuración de Orbit | Entrada propia `OrbitGamesNext` |

Next no importa ni modifica el perfil, las portadas o los favoritos de Orbit actual. Ambas aplicaciones pueden ejecutarse a la vez. El paquete de Next tiene un identificador de instalación independiente y no crea accesos directos automáticamente.

Las pruebas de escritorio usan subcarpetas nuevas de `%APPDATA%\Orbit Games Next\qa`. `ORBIT_DATA_DIR` solo admite rutas dentro del perfil de Next; se rechazan rutas externas y enlaces de directorio en ese perfil.

## Estado de la versión alfa

- Asistente inicial: elegir carpetas, buscar, revisar, conectar cuentas opcionales y guardar.
- Detección local existente de plataformas, con resumen por plataforma y carpetas de instalación.
- Carpetas de accesos `.lnk` y `.url`, incluyendo sus subcarpetas inmediatas.
- Carpetas adicionales con ejecutables: búsqueda hasta tres niveles, 5.000 entradas y 200 candidatos por búsqueda. No se siguen enlaces de directorio. Los límites se comunican al usuario.
- Se descartan nombres habituales de instaladores, desinstaladores y herramientas. Los candidatos adicionales requieren selección explícita; no se ejecutan durante la búsqueda.
- Se conservan la configuración y los juegos elegidos después de reiniciar.
- El asistente puede abrirse otra vez desde **Ajustes → Revisar carpetas y juegos**.
- Las consultas de fichas en línea son opcionales.

Hay conectores comunitarios experimentales de Steam, GOG y Epic Games en el asistente y en Ajustes. Las conexiones con cuentas reales todavía requieren validación. No se garantiza cobertura de suscripciones o bibliotecas compartidas. Steam y GOG usan sesiones web propias; Epic guarda sus credenciales cifradas en el perfil de Next. Ninguna conexión utiliza la sesión del lanzador instalado ni requiere servidores de Orbit.

Las consultas fallidas o incompletas conservan la biblioteca anterior. Desconectar elimina la sesión local de Orbit y conserva los juegos y sus ajustes; no revoca por sí mismo autorizaciones desde la web del proveedor. Los juegos manuales y los lanzadores propios pueden añadirse mediante ejecutables o accesos directos. Los archivos encontrados en carpetas adicionales se proponen en escaneos posteriores y requieren revisión; no se ejecutan ni se agregan automáticamente.

En el código posterior a alfa 2, **Añadir/Editar juego → Opciones del ejecutable o lanzador propio** permite argumentos (uno por línea) y carpeta de trabajo para `.exe`. No se interpretan comandos de shell. Los accesos `.lnk` conservan los argumentos definidos en Windows. Se admiten varias entradas con el mismo ejecutable y opciones distintas. Si un ejecutable requiere elevación con argumentos, configura un acceso directo de Windows con esos parámetros y permisos.

## Ejecutar y compilar

El código posterior a alfa 2 añade Humble Bundle como conexión experimental. Distingue descargas para Windows de referencias de claves para otras tiendas y no guarda códigos de canje. La activación y la identidad estable de la cuenta no se verifican; el login real está pendiente. `node scripts/qa-humble.cjs` comprueba el recorrido con respuestas controladas.

Requiere Windows y Node.js 24 compatible con las dependencias fijadas.

El código posterior a alfa 2 también incluye Ubisoft Connect experimental. Consulta accesos del proveedor, conserva las credenciales cifradas en el equipo y permite renovar y desconectar la sesión. La edición para PC se señala como pendiente de verificación. `node scripts/qa-ubisoft.cjs` valida el flujo con respuestas controladas; aún falta probar una cuenta real. Verificación actual del código: 42 pruebas automatizadas y compilación aprobadas; no sustituye la verificación del paquete publicado.

```powershell
git clone --branch feature/orbit-next-onboarding https://github.com/MasterOnly23/orbit-games.git orbit-games-next
cd orbit-games-next
npm ci
npm run dev
```

Para generar el ejecutable independiente sin instalarlo:

```powershell
npm run package:dir
& '.\release-next\win-unpacked\Orbit Games Next.exe'
```

Conserva toda la carpeta `win-unpacked`, no solo el `.exe`. `npm run package` genera el instalador NSIS independiente de Next; no lo instala. Es una versión alfa sin firma comercial ni actualizaciones automáticas.

## Verificación

```powershell
npm test
npm run package:dir
npm run test:desktop
node scripts/qa-vault.cjs
node scripts/qa-epic.cjs
```

Las pruebas de dominio cubren la biblioteca original, el aislamiento de perfiles, la selección de carpetas, los límites de búsqueda y la confirmación antes de persistir. La prueba de escritorio utiliza el ejecutable de Next y un perfil vacío, recorre el asistente, elige un archivo ficticio que nunca se ejecuta, reinicia y comprueba la persistencia. No depende de que exista un juego comercial concreto ni una cantidad determinada de juegos.

`output/` contiene los informes y capturas locales y queda excluido de Git. `VERIFICACION.md` describe la comprobación histórica de Orbit 1.0.0, no certifica Next. El roadmap general sigue en `ROADMAP.md`.

Comprobación del 8 de septiembre de 2026: 30 pruebas unitarias aprobadas y recorrido de escritorio desde código, incluyendo perfil vacío, cuentas omitidas, selección de ejecutable, portada local, reinicio, descubrimiento posterior y ausencia de solicitudes remotas con las fichas desactivadas. `qa-vault.cjs` usa cifrado real de Windows con datos ficticios. `qa-epic.cjs` comprueba la integración completa con respuestas controladas; no acredita el login real de Epic. Faltan cuentas reales, otras plataformas, Windows 10, instalación y actualizaciones, beta externa y los demás criterios de `PRODUCT_PLAN.md`.

## Estructura

- `electron/runtime.cjs`: identidad y límites del perfil de Next.
- `electron/onboarding/`: descubrimiento de carpetas, vista previa y confirmación de la configuración.
- `src/features/onboarding/`: asistente inicial.
- `electron/library/`: inventario, combinación de fuentes y persistencia.
- `electron/platform/`: consultas de Windows y lanzamiento de juegos.
- `electron/ipc.cjs` y `electron/preload.cjs`: operaciones de biblioteca y puente aislado.

No se distribuyen bibliotecas personales, credenciales, portadas descargadas, capturas ni instaladores en Git. Las marcas y contenidos de terceros pertenecen a sus respectivos titulares.
