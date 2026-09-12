# Orbit Games Next 0.2.0-alpha.5

Alfa local de desarrollo del 12 de septiembre de 2026. El objetivo público sigue pendiente; esta entrega reúne avances posteriores a alfa 4 en un paquete independiente de Orbit Games estable.

## Cambios desde alfa 4

- Idioma y región de fichas en Ajustes y en el asistente inicial; consultas en línea opcionales.
- Actualizar ficha vuelve a consultar Steam con las preferencias guardadas y conserva el juego vinculado. El editor admite fichas incompletas.
- Recuperación ante fallo del guardado final del asistente, aviso visible y reintento con la misma revisión.
- Detección local de recibos itch.io y de entradas Blizzard del registro con ejecutable propio; límites documentados por plataforma.
- Cobertura por plataforma visible en la configuración de cuentas, según los conectores realmente habilitados.
- Correcciones de accesos Epic malformados, asociación de rutas del registro y estado de bibliotecas Steam inaccesibles.
- Separación de ventana, cuentas, fichas y detectores locales para mantener las responsabilidades fuera de main y del coordinador de escaneo.

## Uso

Abrir `ABRIR_ORBIT_NEXT.cmd`, que apunta a `release-next/alpha5/win-unpacked/Orbit Games Next.exe`. Debe conservarse toda la carpeta `win-unpacked`; no requiere Node.js para ejecutar el paquete.

Las alfas de Next comparten `%APPDATA%\Orbit Games Next`: cerrar otra alfa de Next antes de abrir esta. Orbit Games estable puede seguir abierto. El instalador NSIS se genera sin ejecutarlo; no sustituye la instalación de Orbit Games estable.

## Límites

Conectores de cuenta experimentales sin validación completa con cuentas reales. itch.io requiere registro OAuth de Orbit. Battle.net tiene detección parcial del registro, no conexión de cuenta ni lectura de product.db. No se han verificado todos los lanzamientos de juegos detectados.

Windows 10 x64, matriz completa de Windows 11, instalación/actualización/desinstalación, firma, actualizaciones automáticas y beta externa siguen pendientes. La generación del instalador no demuestra esos requisitos. La compilación conserva un aviso de bloque JavaScript superior a 500 kB.

Las pruebas se ejecutan en perfiles de QA aislados. Los archivos de juegos, cuentas y sesiones personales no se distribuyen con el proyecto.

## Verificación de esta generación

- 88 pruebas automatizadas aprobadas antes del empaquetado; compilación de producción correcta.
- `qa-desktop.cjs` desde alfa 5: asistente, idioma/región, fallo de guardado y reintento con foco en el aviso, cuentas opcionales y cobertura, cancelación, alta manual, portadas/etiquetas tras reiniciar y escanear, filtros y ancho de 1000 px. Sin errores del renderizador.
- `qa-backup.cjs` desde alfa 5: diagnóstico, cancelación, restauración entre perfiles y portada visible después de reiniciar.
- `qa-shutdown.cjs` desde alfa 5: espera de escritura al cerrar, fallo de guardado que mantiene la ventana abierta y reintento antes de salir.
- `qa-metadata-locale.cjs` desde alfa 5: preferencias persistidas, rechazo de configuración inválida sin activar consultas y actualización del juego vinculado con respuestas controladas de Steam.
- ASAR: versión 0.2.0-alpha.5 y 49 archivos de Electron iguales al código fuente. Sin carpetas raíz de pruebas, scripts, salidas, credenciales ni Git. Inspección acotada, no auditoría exhaustiva.
- Instalador generado y no ejecutado; firma `NotSigned`. Equipo de pruebas Windows 11 x64, compilación 26200.

| Archivo | SHA-256 |
|---|---|
| `Orbit Games Next Setup 0.2.0-alpha.5.exe` | `468CDCA30A512DC9B1510C63816DB436BF89BC4FDB2CA81BC54F0BD81F65DA40` |
| `win-unpacked/Orbit Games Next.exe` | `8EE286771260CB911FCA49D96FBEC4B91A4A93BDC4C953E3026F84813ADEF25E` |
| `win-unpacked/resources/app.asar` | `2986C1525B6952BE69D9EF07236E03B77AF6DC0DEE8F2AB64F15E4B50F16DA2F` |

Orbit Games estable conserva su ASAR con SHA-256 `30E451EB6A43D6ADC733DB8AA0F3FF0BD5F4C17F2F60A5C8B3033C8D4219F529`. Estos hashes identifican esta generación local; recompilar el paquete puede cambiarlos.
