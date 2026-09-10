# Orbit Games Next 0.2.0-alpha.4

Alfa local de desarrollo preparada el 10 de septiembre de 2026. Conserva la instalación y el perfil independientes de Orbit Games estable. No es un candidato público.

## Cambios desde alfa 3

- Detener búsqueda en el asistente y detener detección en la biblioteca, descartando resultados tardíos antes de guardar.
- Exportar diagnóstico desde Ajustes con datos operativos agregados, sin nombres, rutas, notas ni credenciales; no se envía automáticamente.
- Cierre coordinado: espera operaciones y escrituras pendientes. Un fallo de escritura mantiene la app abierta y permite guardar de nuevo.
- Restricción de IPC al documento exacto de Orbit y a su ventana y marco principal.
- Etiquetas personales al añadir o editar juegos, filtro combinable y conservación en escaneos, sincronizaciones y respaldos.

## Uso

`ABRIR_ORBIT_NEXT.cmd` abre `release-next/alpha4/win-unpacked/Orbit Games Next.exe`. Mantener toda la carpeta `win-unpacked`; no requiere Node.js para ejecutarse. El instalador NSIS x64 se genera en `release-next/alpha4` y no se ejecuta durante el empaquetado.

Cerrar cualquier otra alfa de **Orbit Games Next** antes de abrir esta: las alfas comparten el perfil `%APPDATA%\Orbit Games Next`. Orbit Games estable puede seguir abierto. Las alfas anteriores permanecen en sus carpetas.

## Verificación

70 pruebas automatizadas y compilación de producción aprobadas. La compilación conserva el aviso de un bloque JavaScript superior a 500 kB.

Pruebas aprobadas desde `release-next/alpha4/win-unpacked/Orbit Games Next.exe`, en perfiles de QA independientes:

- `qa-desktop.cjs`: onboarding, cancelación y reintento de búsquedas, alta manual, argumentos, portadas y etiquetas después de reiniciar y escanear, cancelación general, filtros, eliminación de etiquetas, rechazo de datos inválidos y ancho de 1000 px. Sin errores del renderizador.
- `qa-backup.cjs`: diagnóstico local y cancelación de exportación, exportación/restauración entre perfiles, juego manual y portada visible después de reiniciar.
- `qa-shutdown.cjs`: escritura detenida durante el cierre, persistencia antes de salir, error ENOSPC simulado que mantiene la ventana abierta y guardado correcto tras reintentar.
- ASAR: versión correcta y 35 archivos de Electron idénticos al código fuente. Sin directorios raíz de pruebas, scripts, salidas, credenciales ni Git; esta comprobación acotada no es una auditoría exhaustiva de contenido.
- Instalador generado sin ejecutarlo; firma `NotSigned`. Validado localmente en Windows 11, compilación 26200, x64; no acredita Windows 10 ni la matriz completa de Windows 11.

| Archivo | SHA-256 |
|---|---|
| `Orbit Games Next Setup 0.2.0-alpha.4.exe` | `D7E72CE3491CB7C0C88A853EA5DCAB438EF6CD6F26C97D49A50F42C1BAC09C5E` |
| `win-unpacked/Orbit Games Next.exe` | `E3EBE259260860708B5287A95BF2125F857E33D4A0CA7AF0ECB2BF51651DB263` |
| `win-unpacked/resources/app.asar` | `0964B20D96A4BB546488F6A2D7319C4E118F5E2A21AE3BED95F07B53E02E704F` |

El ASAR de Orbit Games estable instalado conserva SHA-256 `30E451EB6A43D6ADC733DB8AA0F3FF0BD5F4C17F2F60A5C8B3033C8D4219F529`. Los hashes identifican esta generación local y cambiarán al volver a empaquetar.

## Requisitos todavía pendientes

- Cuentas reales por proveedor, segundo factor, renovación/revocación y catálogos grandes; cobertura restante de plataformas.
- Windows 10 x64 y matriz completa de Windows 11 x64; generar un ejecutable no acredita instalación, actualización o desinstalación.
- Firma, actualización automática, distribución y beta externa.
- Cierres forzados, cortes de energía, accesibilidad completa, colecciones, duplicados y restantes requisitos de PRODUCT_PLAN.md.

Este paquete no instala ni modifica Orbit Games estable. Los respaldos no incluyen archivos de juegos ni sesiones de plataformas.
