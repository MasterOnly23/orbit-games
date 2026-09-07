# Orbit Games

Aplicación de escritorio para Windows 10/11 que reúne juegos y accesos directos en una biblioteca oscura. Se ejecuta localmente, abre los lanzadores existentes y no necesita iniciar sesión en cuentas de juego.

## Usar la aplicación

Abre **Orbit Games** desde el acceso directo del escritorio. El instalador está en `release/Orbit Games Setup 1.0.0.exe`. La aplicación también se puede ejecutar directamente desde `release/win-unpacked/Orbit Games.exe`, conservando toda esa carpeta.

- **Seleccionar un juego** cambia la imagen principal y muestra su ficha. **Jugar ahora** inicia el juego mediante Windows o su lanzador.
- **Añadir juego** acepta `.exe`, `.lnk`, `.url` y enlaces compatibles de lanzadores.
- Agrega accesos a **Escritorio → Games** para detectarlos automáticamente. En Ajustes puedes añadir más carpetas. Se incluyen las subcarpetas inmediatas; no se recorren todos los archivos internos de los juegos.
- **Editar juego** permite cambiar nombre, acceso, notas y estado, elegir una ficha de Steam o usar una imagen de tu PC.
- **Ajustes → Abrir al iniciar Windows** activa o desactiva el inicio de Orbit al iniciar sesión.
- **Seguir en la bandeja al cerrar** mantiene activa la detección. Para cerrar completamente, usa **Salir** en el icono junto al reloj.
- La estrella guarda favoritos; **Recientes** muestra los juegos iniciados desde Orbit. **Sorpréndeme** selecciona uno instalado sin ejecutarlo.
- **Ctrl + K** enfoca la búsqueda. Los botones, filtros y formularios se pueden usar con teclado.

## Qué detecta

| Origen | Evidencia de instalación | Inicio |
|---|---|---|
| Steam | Bibliotecas registradas, manifiestos ACF, estado de instalación y carpeta | Protocolo Steam con AppID |
| Epic Games | Manifiestos locales y ejecutable | Protocolo de Epic con los identificadores del juego |
| EA app | Registro de Windows y ejecutables; accesos de Games | Acceso original o ejecutable registrado |
| Xbox / Microsoft Store | Paquetes del usuario, AppsFolder y MicrosoftGame.config | Identificador de aplicación de Windows |
| Ubisoft | Accesos y registro de instalaciones disponible | Protocolo Ubisoft o acceso |
| Riot | Accesos, metadatos locales de producto y ejecutable cuando está disponible | Acceso original con sus argumentos |
| Otros / lanzador propio | Destino de accesos a ejecutables | Acceso original o ejecutable |

**Instalado** significa que hay evidencia local accesible. No garantiza que todos los archivos estén íntegros, ni sustituye la verificación de archivos, las actualizaciones, la suscripción o las credenciales que pueda exigir el lanzador. **No instalado** indica que falta la instalación identificable. **Sin verificar** conserva los casos ambiguos, fuentes desaparecidas, unidades no disponibles o lanzadores compartidos sin evidencia del juego. Puedes corregir el estado manualmente y el siguiente escaneo conserva esa elección.

Los juegos no instalados se conocen por los accesos de Games y por entradas conservadas en la biblioteca. Orbit no descarga todo el catálogo comprado en cada cuenta. Una descarga independiente sin acceso directo se agrega manualmente. No instala juegos automáticamente ni modifica sus carpetas o partidas.

## Imágenes y fichas

Las fichas públicas se consultan en Steam por AppID o coincidencia exacta del nombre. No se asignan resultados aproximados automáticamente. Desde **Editar** puedes elegir la ficha correcta sin cambiar la plataforma desde la que se ejecuta el juego. Algunas descripciones solo están disponibles en el idioma que publica el estudio.

Las imágenes remotas necesitan conexión; las fichas ya consultadas y las imágenes que eliges desde tu PC se guardan localmente. Los juegos sin imagen usan una portada de respaldo. Las imágenes y marcas de juegos pertenecen a sus respectivos titulares.

## Datos locales y respaldo

Se guardan en `%APPDATA%\Orbit Games`:

- `library.json`: biblioteca, favoritos, notas, rutas y ajustes.
- `library.json.bak`: última copia anterior a la escritura actual.
- `artwork/`: imágenes personales.

Las escrituras son atómicas y la app intenta recuperar la copia anterior si el archivo principal se daña. **Exportar preferencias** crea un JSON con favoritos, nombres, ocultos y notas; **Restaurar** lo aplica a los juegos ya detectados. Para un respaldo completo, cierra Orbit y copia la carpeta `%APPDATA%\Orbit Games`. No incluye los archivos ni las partidas de los juegos.

## Desarrollo

Requiere Windows y Node.js 24 LTS o compatible con la versión fijada de Vite. PowerShell:

```powershell
git clone https://github.com/MasterOnly23/orbit-games.git
cd orbit-games
npm ci
npm run dev
```

Compilación y pruebas:

```powershell
npm test
npm run build
npm run package
```

`npm run start` abre la última interfaz compilada. `npm run dev` usa Vite y Electron. La versión de Electron se distribuye con la aplicación: el usuario final no necesita Node.js.

## Arquitectura y comprobación

- `electron/main.cjs`: ventana, eventos, detección programada y ciclo de vida.
- `electron/ipc.cjs`: contrato de operaciones de la app, validación y diálogos nativos.
- `electron/library/`: detección, combinación de fuentes, persistencia y fichas públicas.
- `electron/platform/`: consulta acotada de Windows y lanzamiento.
- `electron/preload.cjs`: API específica por operación, sin exponer Node.js al renderizador.
- `src/features/library/` y `src/features/settings/`: interfaz y flujos.

Se utiliza aislamiento de contexto, sandbox, CSP, validación del emisor de IPC, protocolos de lanzamiento admitidos y `shell: false` cuando se crea un proceso. Las imágenes locales se sirven por un protocolo limitado a los identificadores de la biblioteca. Referencias: [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [inicio con Windows](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows), [automatización de Electron con Playwright](https://playwright.dev/docs/api/class-electron).

`tests/library.test.cjs` verifica combinación de fuentes, conservación de preferencias, protocolos, destinos ausentes y recuperación del respaldo. `scripts/qa-desktop.cjs` abre Electron, usa un perfil de prueba separado, verifica la interfaz y ejecuta un pequeño programa propio que deja constancia de su ejecución. Los resultados y capturas quedan en `output/playwright/`. El script comprueba temporalmente el ajuste de inicio de Windows y restaura el valor inicial.

La comprobación de escritorio depende del inventario del equipo original: espera más de 90 juegos y una entrada de Cyberpunk 2077 en `Escritorio\Games`. Todavía no es una prueba portátil para cualquier equipo. Los scripts `inspect-app.cjs` y `final-preview.cjs` también son herramientas de comprobación local; sus resultados no se incluyen en el repositorio.

Para ejecutar la comprobación de escritorio en un equipo con ese inventario:

```powershell
npm run build
New-Item -ItemType Directory -Path output -Force
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /out:output\launch-fixture.exe scripts\launch-fixture.cs
node scripts/qa-desktop.cjs
```

El instalador local no tiene certificado de firma comercial. Windows puede mostrar el editor como desconocido. No hay actualizaciones automáticas; para actualizar esta versión se vuelve a compilar e instalar.
