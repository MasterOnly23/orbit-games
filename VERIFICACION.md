# Comprobación de Orbit Games 1.0.0

Fecha: 6 de septiembre de 2026. Plataforma: Windows x64, en el equipo de destino.

La aplicación quedó instalada en `%LOCALAPPDATA%\Programs\Orbit Games\Orbit Games.exe`, con acceso directo `Orbit Games.lnk` en el escritorio del usuario. El instalador terminó con código 0 y el SHA-256 de `resources/app.asar` instalado coincide con el del paquete validado. El inicio con Windows queda desactivado inicialmente.

Este documento registra la comprobación inicial en un equipo concreto. Los conteos y resultados de integración son históricos y dependen de su inventario; no certifican compatibilidad con todos los equipos. La biblioteca personal, las portadas, las capturas y los instaladores no se incluyen en el repositorio.

Inventario entregado: **106 entradas**, **47 instaladas**, **51 no instaladas** y **8 sin verificar**. La biblioteca real no contiene los ejecutables ni accesos de las pruebas. El primer lote de fichas se consultó en línea y la aplicación continúa completándolas mientras está abierta.

## Resultado por requisito

| Requisito | Evidencia |
|---|---|
| Aplicación de escritorio de Windows | Electron empaquetado en `release/win-unpacked/Orbit Games.exe`; instalador NSIS por usuario, con nombre e icono propios |
| Carpeta Games del escritorio | Escaneo real de accesos `.lnk`/`.url` y sus subcarpetas inmediatas; el acceso a la web de iRacing se excluye porque no es un juego |
| Steam, EA, Xbox, Epic y lanzadores propios | Lectura real de manifiestos, registro de instalaciones y paquetes de Windows; Steam se detecta en C:, E:, F: y L: |
| Instalado / no instalado | Evidencia local visible y tercer estado `Sin verificar` para casos ambiguos; corrección manual persistente |
| Lanzar desde la app | Un ejecutable de prueba propio fue añadido con la interfaz y ejecutado por Windows; escribió una prueba nueva en disco, confirmó que su carpeta de trabajo era la del ejecutable y se guardó en Recientes |
| Enlace de Xbox | El botón de Balatro inició el `GameLaunchHelper.exe` del paquete `PlayStack.Balatro` y la ventana de Gaming Services titulada `Balatro`; no se observó el proceso del motor `love.exe`, por lo que solo queda confirmado el paso al cargador de Xbox |
| Splash / portada del juego | Selección y cambio de imagen principal verificados visualmente; portada automática y selección de imagen local verificadas |
| Datos del juego | Consulta real de la ficha de Cyberpunk 2077 en Steam; descripción, géneros, fecha y procedencia visibles |
| Detectar novedades | Creación de un acceso `.url` en una carpeta vigilada; apareció sin pulsar Detectar |
| Agregar a mano | Formulario, selector de archivo, alta real y lanzamiento del programa de prueba |
| Abrir al iniciar Windows | Alta real, lectura del ajuste de Windows y restauración al valor inicial; no se reinició Windows |
| Dark mode | Interfaz completa oscura, revisión a 1480 px y 1000 px; sin desbordamiento horizontal |
| Favoritos y notas | Edición por interfaz y comprobación después de cerrar completamente y volver a abrir la app |

Las comprobaciones automáticas se ejecutan en un perfil separado: `.test-data/desktop-qa`. Los datos de prueba no se mezclan con la biblioteca entregada. El ejecutable utilizado en la segunda comprobación fue el empaquetado, con su recurso PowerShell fuera de ASAR.

## Resultados reproducibles

- `npm test`: 10 pruebas de dominio y persistencia aprobadas.
- `npm run build`: compilación aprobada.
- `npm run package`: instalador y ejecutable de Windows generados.
- `scripts/qa-desktop.cjs`: resultados detallados en `output/playwright/qa-results.json` y capturas en esa carpeta.
- `npm audit --omit=dev --audit-level=high`: no informó vulnerabilidades en la consulta realizada.

Para comprobar el ejecutable empaquetado con la prueba de escritorio:

```powershell
$env:ORBIT_TEST_EXE = (Resolve-Path 'release\win-unpacked\Orbit Games.exe').Path
node scripts/qa-desktop.cjs
Remove-Item Env:\ORBIT_TEST_EXE
```

## Límites de la comprobación

No se ejecutaron todos los juegos ni se comprobó la integridad de sus archivos, las licencias, las suscripciones o el acceso a las cuentas de cada plataforma. Esos requisitos siguen a cargo de los lanzadores. El retorno correcto de Windows significa que aceptó el inicio, no que el juego llegó al menú. La interfaz usa por eso el mensaje `Inicio solicitado`.

El catálogo completo de compras en la nube no se importa; los juegos no instalados se conservan a partir de accesos y entradas conocidas. Las imágenes remotas necesitan conexión. El instalador es local y no tiene firma comercial.
