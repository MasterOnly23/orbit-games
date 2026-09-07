# Orbit Games Next

Primera versión de desarrollo para configurar Orbit en otros equipos Windows. Esta rama conserva una identidad independiente de **Orbit Games 1.0.0**.

## Dos aplicaciones independientes

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

## Primer incremento

- Asistente inicial: elegir carpetas, buscar, revisar y guardar.
- Detección local existente de plataformas, con resumen por plataforma y carpetas de instalación.
- Carpetas de accesos `.lnk` y `.url`, incluyendo sus subcarpetas inmediatas.
- Carpetas adicionales con ejecutables: búsqueda hasta tres niveles, 5.000 entradas y 200 candidatos por búsqueda. No se siguen enlaces de directorio. Los límites se comunican al usuario.
- Se descartan nombres habituales de instaladores, desinstaladores y herramientas. Los candidatos adicionales requieren selección explícita; no se ejecutan durante la búsqueda.
- Se conservan la configuración y los juegos elegidos después de reiniciar.
- El asistente puede abrirse otra vez desde **Ajustes → Revisar carpetas y juegos**.
- Las consultas de fichas en línea son opcionales.

No hay conexión con cuentas todavía. La biblioteca completa de compras, los juegos accesibles por suscripción y la unificación de varias licencias de un mismo juego son trabajo posterior. Los ejecutables arbitrarios se identifican por nombre de archivo y pueden requerir corrección manual. Los nuevos ejecutables en carpetas adicionales se revisan reabriendo el asistente; no se importan automáticamente.

## Ejecutar y compilar

Requiere Windows y Node.js 24 compatible con las dependencias fijadas.

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
```

Las pruebas de dominio cubren la biblioteca original, el aislamiento de perfiles, la selección de carpetas, los límites de búsqueda y la confirmación antes de persistir. La prueba de escritorio utiliza el ejecutable de Next y un perfil vacío, recorre el asistente, elige un archivo ficticio que nunca se ejecuta, reinicia y comprueba la persistencia. No depende de que exista un juego comercial concreto ni una cantidad determinada de juegos.

`output/` contiene los informes y capturas locales y queda excluido de Git. `VERIFICACION.md` describe la comprobación histórica de Orbit 1.0.0, no certifica Next. El roadmap general sigue en `ROADMAP.md`.

Comprobación del 7 de septiembre de 2026: 14 pruebas aprobadas, compilación y paquete independiente generados. El recorrido de escritorio pasó tanto desde el código como desde el ejecutable empaquetado, incluyendo perfil vacío, selección de ejecutable, portada local, reinicio, reapertura del asistente y ausencia de solicitudes remotas con las fichas desactivadas. Se revisó la interfaz a 1480 y 1000 píxeles de ancho. Esto valida este incremento en el equipo de desarrollo; faltan la beta en otros equipos, la instalación NSIS y los demás criterios del MVP 1.

## Estructura

- `electron/runtime.cjs`: identidad y límites del perfil de Next.
- `electron/onboarding/`: descubrimiento de carpetas, vista previa y confirmación de la configuración.
- `src/features/onboarding/`: asistente inicial.
- `electron/library/`: inventario, combinación de fuentes y persistencia.
- `electron/platform/`: consultas de Windows y lanzamiento de juegos.
- `electron/ipc.cjs` y `electron/preload.cjs`: operaciones de biblioteca y puente aislado.

No se distribuyen bibliotecas personales, credenciales, portadas descargadas, capturas ni instaladores en Git. Las marcas y contenidos de terceros pertenecen a sus respectivos titulares.
