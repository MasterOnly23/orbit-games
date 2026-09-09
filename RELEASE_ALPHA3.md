# Orbit Games Next 0.2.0-alpha.3

Alfa local para pruebas, preparada el 9 de septiembre de 2026. No es un candidato público ni un reemplazo de Orbit Games 1.0.0.

## Cambios desde alfa 2

- Argumentos y carpeta de trabajo para juegos manuales y lanzadores propios; entradas independientes para configuraciones distintas del mismo ejecutable.
- Conectores experimentales Humble y Ubisoft, junto con Steam, GOG y Epic. Cancelación de operaciones de cuentas. itch.io preparado detrás de configuración OAuth pendiente de registro.
- Detección mediante manifiestos de Riot para League of Legends y VALORANT; identidades del registro de GOG compatibles con el catálogo de cuenta.
- Respaldo portable del catálogo, preferencias y portadas locales, restauración con revisión y compatibilidad con copias antiguas de preferencias.
- Protección de bibliotecas creadas por formatos incompatibles: una versión anterior no las sustituye por un respaldo más viejo.
- Progreso personal y filtro combinable: Por jugar, Jugando, En pausa, Completado y Dejado.

## Artefactos generados

- Ejecutable con recursos: `release-next/alpha3/win-unpacked/Orbit Games Next.exe`.
- Instalador NSIS x64: generado en `release-next/alpha3/`; no ejecutado durante el empaquetado.
- `ABRIR_ORBIT_NEXT.cmd` apunta al ejecutable de alfa 3.

Mantener toda la carpeta `win-unpacked` para ejecutarlo sin instalar. Antes de abrir esta alfa con tu perfil habitual, cierra cualquier otra versión de **Orbit Games Next**. Puedes mantener abierto Orbit Games 1.0.0.

## Verificación

Las 54 pruebas automatizadas del código pasaron antes de preparar el paquete. La compilación de producción pasa; conserva el aviso de tamaño de un bloque JavaScript superior a 500 kB.

Pruebas desde `release-next/alpha3/win-unpacked/Orbit Games Next.exe` aprobadas:

- `qa-desktop.cjs`: versión 0.2.0-alpha.3, perfil aislado, asistente sin cuentas, ejecutable manual, argumentos, portada, progreso y preferencias después de reiniciar, nuevos candidatos, filtros y ventana de 1000 px. Sin errores del renderizador ni solicitudes HTTP de fichas desactivadas.
- `qa-backup.cjs`: exportación y restauración entre perfiles, cancelación sin cambios, juego manual y portada visible después de reiniciar.
- Archivo ASAR: versión correcta y módulos de respaldo, progreso, Ubisoft e itch.io presentes; no contiene directorios raíz de pruebas, scripts, sesiones, credenciales ni Git. Esto no equivale a una auditoría exhaustiva del contenido.
- Firma del instalador: `NotSigned`. No se ejecutó el instalador.

SHA-256 de los artefactos comprobados:

| Archivo | SHA-256 |
|---|---|
| `Orbit Games Next Setup 0.2.0-alpha.3.exe` | `A6FC00617B4EF20282E4E2E0C535C7C38C284964AD03D431EDD0ED084407F116` |
| `win-unpacked/Orbit Games Next.exe` | `4078FBCAB8749D2253467F22B26D3A46A82E0522940B5B2E6CF6CDA97ED71FA7` |
| `win-unpacked/resources/app.asar` | `390701F105E179983A08C8B2A23D5185C79B3438EB3FE3B13E90262D83E44870` |

Los archivos cambiarán de hash si se vuelven a generar; estos identifican el paquete local verificado. El contenido de `resources/app.asar` del Orbit estable instalado conserva el hash `30E451EB6A43D6ADC733DB8AA0F3FF0BD5F4C17F2F60A5C8B3033C8D4219F529`.

## Límites que siguen abiertos

- Autenticación y cobertura con cuentas reales, segundo factor, revocación y bibliotecas grandes por proveedor.
- Windows 10 x64; instalación limpia, actualización y desinstalación en ambos sistemas objetivo. Generar NSIS no acredita esos recorridos.
- Firma y confianza del instalador, actualización automática y beta externa.
- Cobertura restante de plataformas, colecciones/etiquetas, accesibilidad completa y los demás requisitos de `PRODUCT_PLAN.md`.
- Los respaldos no incluyen juegos instalados ni sesiones. Las rutas nuevas restauradas requieren verificación en el equipo de destino.

Orbit actual conserva su instalación y perfil independientes. Las alfas de Next sí comparten entre ellas el perfil `%APPDATA%\Orbit Games Next`.
