# Validación de Windows para el primer lanzamiento público

Requisito confirmado: Windows 10 y Windows 11, ambos x64, desde el primer lanzamiento público. Ninguno se considera validado por compilar el código o probar el otro sistema.

## Matriz de aceptación

Registrar para cada ejecución: versión y compilación exacta de Windows, arquitectura, commit, versión del paquete, SHA-256 del instalador, usuario estándar/administrador, fecha y resultados. Usar un perfil de prueba de Next; conservar intacto Orbit estable.

| Recorrido | Windows 10 x64 | Windows 11 x64 |
|---|---|---|
| Instalación limpia con usuario estándar y apertura desde el paquete | Pendiente | Pendiente para candidato público |
| Asistente sin cuentas; carpetas predeterminadas y personalizadas | Pendiente | Comprobación local de desarrollo; repetir con candidato |
| Juegos manuales, argumentos y carpeta de trabajo | Pendiente | Comprobación local de desarrollo; repetir con candidato |
| Portadas, favoritos y preferencias después de reiniciar | Pendiente | Comprobación local de desarrollo; repetir con candidato |
| Biblioteca sin Internet y disco de juegos desconectado | Pendiente | Pendiente de recorrido completo |
| Cuenta real: login, segundo factor, sincronización, expiración y desconexión por proveedor | Pendiente | Pendiente |
| Inicio con Windows, bandeja y salida completa | Pendiente | Pendiente de recorrido completo |
| Actualización preservando biblioteca, portadas y sesiones | Pendiente | Pendiente |
| Recuperación de biblioteca corrupta y restauración de respaldo | Pendiente | Pruebas automatizadas; falta recorrido empaquetado |
| Desinstalación y reinstalación con tratamiento explícito de datos | Pendiente | Pendiente |
| Teclado y escalados 100%, 125%, 150% y 200% | Pendiente | Pendiente de matriz completa |
| Convivencia con Orbit estable sin modificar su perfil ni instalación | Pendiente | Comprobaciones locales; repetir con candidato |

## Criterio de publicación

- Ejecutar la matriz con el mismo candidato empaquetado en ambos sistemas; no sustituir resultados con pruebas desde el código fuente.
- Registrar qué versiones concretas de Windows se admiten y comprobar los requisitos del runtime y de cada lanzador antes de anunciar compatibilidad. “Windows 10” no equivale a cualquier compilación histórica de Windows 10.
- Una máquina virtual permite comprobar instalación y configuración, pero no acredita por sí sola lanzamiento de juegos, GPU, DRM o anticheat. Estos recorridos requieren equipos adecuados y juegos de prueba autorizados.
- Las respuestas simuladas de proveedores verifican el comportamiento de Orbit ante esos datos; no acreditan disponibilidad de la API ni acceso real a una cuenta.
- Un fallo bloqueante en cualquiera de los dos sistemas impide anunciar el primer lanzamiento público compatible con ambos.

La disponibilidad de un equipo de pruebas con Windows 10 aún no está confirmada. Esto no impide continuar el desarrollo, pero mantiene pendiente la aceptación de ese sistema.
