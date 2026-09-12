# Orbit Games Next

Mapa de responsabilidades y reglas para ampliar el proyecto: [ARCHITECTURE.md](ARCHITECTURE.md).

Biblioteca de juegos para Windows en desarrollo. La rama `feature/orbit-next-onboarding` mantiene una aplicación independiente de Orbit Games 1.0.0. El objetivo público exige Windows 10 y 11 x64; esa compatibilidad aún no está acreditada en ambos sistemas.

## Alfa 4

La versión `0.2.0-alpha.4` reúne el asistente inicial, detección de juegos, conexiones experimentales, lanzadores propios, respaldo con portadas y progreso personal. Consulta [las notas y límites de alfa 4](RELEASE_ALPHA4.md), [el plan completo](PRODUCT_PLAN.md) y [la matriz de Windows](WINDOWS_VALIDATION.md).

## Convivencia con Orbit actual

| Elemento | Orbit actual | Orbit Next |
|---|---|---|
| Rama | `main` | `feature/orbit-next-onboarding` |
| Aplicación | Orbit Games | Orbit Games Next |
| Identificador | `com.pipe.orbitgames` | `com.pipe.orbitgames.next` |
| Perfil | `%APPDATA%\Orbit Games` | `%APPDATA%\Orbit Games Next` |
| Salida actual | `release/` | `release-next/alpha4/` |
| Inicio con Windows | Entrada de Orbit | Entrada `OrbitGamesNext` |

Next no importa ni modifica automáticamente el perfil de Orbit actual. Ambas aplicaciones pueden ejecutarse a la vez. Las distintas alfas de Next comparten su perfil de Next; cierra una alfa de Next antes de abrir otra, porque la protección de instancia única puede enfocar la que ya está abierta. No hace falta cerrar Orbit Games 1.0.0.

Las pruebas usan perfiles nuevos dentro de `%APPDATA%\Orbit Games Next\qa`. Se rechazan rutas de perfil externas y enlaces de directorio. No se distribuyen bibliotecas personales, sesiones, portadas descargadas ni capturas en Git.

## Usar el paquete local

Ejecuta `ABRIR_ORBIT_NEXT.cmd` en este checkout, o abre:

```powershell
& '.\release-next\alpha4\win-unpacked\Orbit Games Next.exe'
```

Conserva toda la carpeta `win-unpacked`; el `.exe` depende de sus recursos. No requiere Node.js para ejecutarse. El instalador NSIS se genera en `release-next/alpha4/`; generarlo no lo instala. La alfa no tiene firma comercial ni actualización automática.

## Funciones disponibles

En el código posterior a alfa 4, **Ajustes → Idioma y región de las fichas** permite elegir entre 12 idiomas y una región de consulta opcional. **Editar juego → Actualizar ficha** vuelve a consultar Steam con esas preferencias y conserva la vinculación elegida. La disponibilidad de traducciones depende de cada juego; el idioma de la interfaz continúa siendo español. Estos cambios todavía no están incluidos en el instalador alfa 4.

El asistente inicial también permite elegir idioma y región al revisar los juegos. Se guardan al finalizar y no activan por sí solos las consultas en línea.

Alfa 4 añade etiquetas personales y filtro combinable, cancelación del escaneo general y cierre coordinado que espera los guardados pendientes. Si falla la escritura al salir, Orbit permanece abierto para permitir corregir el problema y guardar de nuevo.

Alfa 4 incorpora **Ajustes → Exportar diagnóstico**. Guarda un JSON local con versiones, recuentos, estado de conexiones y códigos de error. No incluye nombres, rutas, notas, imágenes ni credenciales, y no lo envía automáticamente. No es un respaldo de la biblioteca.

Alfa 4 añade **Detener búsqueda** al asistente: permite cancelar, corregir carpetas y reintentar sin guardar resultados. El guardado final debe terminar. Los cambios de paso llevan el foco al título para navegación por teclado.

- Asistente: carpetas, revisión de candidatos, cuentas opcionales y guardado. Se puede repetir desde Ajustes.
- Detección de accesos y fuentes locales de lanzadores. Las carpetas de ejecutables se exploran hasta tres niveles, con límites de 5.000 entradas y 200 candidatos; no se ejecutan los archivos descubiertos. Los candidatos requieren confirmación.
- Juegos manuales y lanzadores propios: argumentos por línea y carpeta de trabajo para `.exe`. Los `.lnk` mantienen sus opciones de Windows. No se interpretan comandos de shell. Los ejecutables elevados con argumentos requieren un acceso directo configurado en Windows.
- Estados de instalación diferenciados: instalado, no instalado y sin verificar. La presencia de un lanzador compartido no prueba una instalación.
- Favoritos, recientes, notas, nombres personalizados, ocultos, búsqueda, filtros y portadas locales. Las fichas de Steam en línea son opcionales.
- Progreso personal: Por jugar, Jugando, En pausa, Completado y Dejado; filtro combinable con plataforma, instalación y búsqueda. No modifica logros del proveedor.
- Respaldo portable: catálogo, rutas, argumentos, preferencias, fichas y portadas locales. No incluye archivos de juegos ni sesiones. Al restaurar conserva juegos ajenos a la copia, rutas existentes, cuentas y carpetas vigiladas actuales. Nuevas entradas quedan sin verificar. Admite las preferencias del formato anterior. Límites: 10.000 juegos, 20 MiB por portada y 256 MiB por archivo.

Steam, GOG, Epic, Humble y Ubisoft tienen conectores experimentales; faltan pruebas con cuentas reales y cobertura de suscripciones/compartidos. Humble distingue descargas Windows y referencias de claves sin guardar códigos ni verificar su canje. Ubisoft señala que la edición para PC necesita verificación. itch.io requiere el registro OAuth de Orbit antes de habilitarse: [configuración y límites](ITCH_SETUP.md). No se presenta este estado como soporte universal de plataformas.

## Desarrollo y comprobaciones

Requiere Windows y Node.js 24 compatible con las dependencias fijadas.

```powershell
git clone --branch feature/orbit-next-onboarding https://github.com/MasterOnly23/orbit-games.git orbit-games-next
cd orbit-games-next
npm ci
npm run dev
```

```powershell
npm test
npm run package
npm run test:desktop
$env:ORBIT_TEST_EXE = (Resolve-Path '.\release-next\alpha4\win-unpacked\Orbit Games Next.exe').Path
node scripts/qa-backup.cjs
Remove-Item Env:ORBIT_TEST_EXE
```

Los scripts `qa-epic.cjs`, `qa-humble.cjs`, `qa-ubisoft.cjs` y `qa-itch.cjs` prueban flujos con respuestas controladas; no acreditan login real. `qa-vault.cjs` comprueba cifrado nativo con datos ficticios. Los informes y capturas están en `output/`, excluido de Git. `VERIFICACION.md` es un informe histórico de Orbit 1.0.0.

El código se organiza en `electron/library`, `electron/accounts`, `electron/onboarding` y `electron/platform`, con sus interfaces en `src/features`. Las marcas y contenidos de terceros pertenecen a sus titulares; los avisos de referencias están en `THIRD_PARTY_NOTICES.md`.
