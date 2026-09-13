# Orbit Next — Roadmap de seguimiento

Actualizado: **13 de septiembre de 2026**. Trabajo en `feature/orbit-next-onboarding`, separado de Orbit estable.

## Dónde estamos

**Alfa 5 local disponible; producto público todavía en desarrollo.** Hay biblioteca local, asistente, respaldo con portadas y conectores experimentales. Los cambios de cuenta Battle.net y su asociación por UID son posteriores al paquete alfa 5.

**Avance de esta lista: 22 de 59 tareas cerradas; 37 pendientes.** Es un recuento de tareas, no un porcentaje de esfuerzo ni una fecha estimada. Las pruebas reales de plataformas y distribución concentran incertidumbre; no sería fiable calcular una fecha de lanzamiento con los datos actuales.

- Último incremento cerrado: lector paginado de catálogo EA basado en una referencia comunitaria actual, con controles de integridad y pruebas sintéticas. Adaptador EA integrado al contrato de ventana aislada; captura con HTTPS local verificada; registro visible y validación real pendientes. Véase EA_SUPPORT.md.
- Siguiente trabajo: continuar clásicos/identidad de Battle.net e integraciones EA, Xbox y Amazon; mantener validación externa de Windows y cuentas como requisito de lanzamiento.
- En paralelo al desarrollo: obtener evidencia con cuentas reales y un entorno Windows 10 x64.
- Paquete actual: [alfa 5 y sus pruebas](RELEASE_ALPHA5.md). Requisitos completos e historial: [PRODUCT_PLAN.md](PRODUCT_PLAN.md).

## Cómo leer y mantener las casillas

`[x]` significa que la tarea concreta tiene implementación y evidencia indicada, dentro del alcance descrito. Una prueba controlada puede cerrar una tarea de implementación, pero no la validación real del proveedor ni la aceptación pública de una fase.

En cada incremento: actualizar la casilla correspondiente, su evidencia y la sección «Dónde estamos»; recalcular el recuento; indicar si se incorporó al paquete o solo al código. No marcar una plataforma completa por tener un botón o un lector. Si una capacidad resulta inviable, documentar la fuente y el motivo antes de cerrar su evaluación. Una alternativa manual no equivale a conexión de cuenta.

## 1. Base y arquitectura

- [x] BASE-01 — Identidades, perfiles y paquetes independientes de Orbit estable. Evidencia: RELEASE_ALPHA5.md.
- [x] BASE-02 — Biblioteca local utilizable sin cuenta Orbit ni servidor propio. Evidencia: recorrido de escritorio y PRODUCT_PLAN.md.
- [x] BASE-03 — Separar ventana, cuentas, enriquecimiento y detectores de los coordinadores. Evidencia: ARCHITECTURE.md.
- [x] BASE-04 — Mantener suite automatizada y perfiles aislados de QA. Evidencia: `tests/` y `scripts/qa-*.cjs`.
- [ ] BASE-05 — Separar los comandos de edición, ajustes y archivos de `electron/ipc.cjs` al ampliar esos flujos. Diagnóstico ya extraído a su módulo; los otros comandos siguen pendientes.
- [ ] BASE-06 — Auditar dependencias y tamaño del paquete; corregir cuellos de rendimiento con mediciones de bibliotecas grandes.

## 2. Primera experiencia y configuración

- [x] ONB-01 — Elegir carpetas sugeridas y personalizadas; revisar candidatos antes de importar. Evidencia: qa-desktop.cjs.
- [x] ONB-02 — Cuentas opcionales y posibilidad de terminar sin conectar ninguna. Evidencia: qa-desktop.cjs.
- [x] ONB-03 — Idioma/región de fichas y permiso de consulta independientes. Evidencia: setup-locale.test.cjs y qa-desktop.cjs.
- [x] ONB-04 — Cancelar búsqueda y reintentar; foco al cambiar de paso. Evidencia: setup-cancel.test.cjs y qa-desktop.cjs.
- [x] ONB-05 — Recuperar el intento si falla el guardado final y mostrar el error visible. Evidencia: setup-persistence.test.cjs y qa-desktop.cjs.
- [x] ONB-06 — Reanudar configuración incompleta después de cerrar, con tratamiento claro de borradores y cancelación. Guardado automático de carpetas/preferencias, aviso de estado, recuperación, descarte y reintento. Evidencia: setup-draft.test.cjs, qa-setup-draft.cjs y recorrido qa-desktop.cjs desde código. La búsqueda y la selección de ejecutables se repiten al reanudar; no se reutilizan resultados antiguos. Cierre normal verificado, sin afirmar resistencia a cortes de energía.
- [ ] ONB-07 — Completar ayuda contextual y validar primer arranque tras instalación con usuario estándar en ambos Windows.

## 3. Plataformas y cuentas

El registro de proveedores y `accounts/coverage.cjs` describen la implementación actual. **Ninguna plataforma tiene todavía certificación completa con cuenta real para el lanzamiento público.** Cada casilla siguiente exige: login real, biblioteca, expiración/renovación, desconexión, cambio de cuenta y límites documentados; también inicio de juegos y unión con instalación donde corresponda.

| Plataforma | Código de cuenta | Detección local actual | Falta principal |
|---|---|---|---|
| Steam | Experimental | Manifiestos y bibliotecas múltiples | Cuenta real, visibilidad/compartidos y equipos externos |
| Epic Games | Experimental | Manifiestos y accesos | Cuenta real, renovación, DLC/ediciones |
| GOG | Experimental | Registro e ID de producto | Cuenta real y mayor cobertura de instalaciones |
| Ubisoft Connect | Experimental comunitario | Registro y accesos | Cuenta real, edición PC y suscripciones |
| Humble Bundle | Experimental por sesión | Descargas manuales | Cuenta real, contenido admitido y límites de canje |
| itch.io | Condicionado al registro OAuth | Recibos de instalación | Registrar cliente, cuenta real y bibliotecas especiales |
| Battle.net | Experimental posterior a alfa 5 | Registro Blizzard y accesos | Clásicos, identidad de cuenta, product.db y prueba real |
| EA app | Lector de catálogo en desarrollo; sin conexión | Registro y accesos | Autenticación aislada, unión por oferta y validación real |
| Xbox / Microsoft Store | Pendiente | Paquetes con manifiesto y accesos | Biblioteca, Game Pass y distinción PC/consola |
| Amazon Games | Pendiente | Alta manual | Conector y detector específicos |
| Rockstar Games | Pendiente | Accesos/alta manual | Viabilidad de cuenta y detección específica |
| Riot Games | Pendiente | League/VALORANT live/PBE | Evaluar API de cuenta; ampliar solo con evidencia |

- [ ] ACC-01 — Validar Steam para uso público.
- [ ] ACC-02 — Validar Epic Games para uso público.
- [ ] ACC-03 — Validar GOG para uso público.
- [ ] ACC-04 — Validar Ubisoft Connect para uso público.
- [ ] ACC-05 — Validar Humble Bundle para uso público.
- [ ] ACC-06 — Completar habilitación y validación de itch.io.
- [ ] ACC-07 — Completar Battle.net y validar con cuenta real.
- [ ] ACC-08 — Resolver integración viable de EA app y validarla.
- [ ] ACC-09 — Resolver integración viable de Xbox/Microsoft Store y validarla.
- [ ] ACC-10 — Resolver integración viable de Amazon Games y validarla.
- [ ] ACC-11 — Resolver integración viable de Rockstar y validarla.
- [ ] ACC-12 — Resolver capacidades viables de Riot y validarlas.
- [ ] ACC-13 — Evaluar otras plataformas con APIs o conectores mantenidos; documentar límites de las no viables.

## 4. Detección y catálogo unificado

- [x] DET-01 — Detectores separados, inventario de Windows y búsqueda acotada en carpetas adicionales. Evidencia: ARCHITECTURE.md, tests y QA escritorio.
- [x] DET-02 — Cancelar escaneo antes de guardar y conservar ediciones actuales durante la combinación. Evidencia: scan-service.test.cjs.
- [ ] DET-03 — Ampliar manifiestos/bases locales pendientes, empezando por product.db de Battle.net y Amazon.
- [ ] DET-04 — Validar rutas personalizadas, discos ausentes, permisos y variantes en otras máquinas por plataforma.
- [ ] DET-05 — Completar unión por identificadores y resolver duplicados preexistentes sin perder notas, portadas o accesos. Asociación Battle.net por UID implementada (`1817892`); no basta para cerrar la tarea completa.
- [ ] DET-06 — Probar lanzamientos reales representativos, argumentos, carpeta de trabajo y lanzadores que requieran autenticación.

## 5. Organización y uso diario

- [x] ORG-01 — Alta manual, lanzadores propios, argumentos y carpeta de trabajo. Evidencia: launch-options.test.cjs y qa-desktop.cjs.
- [x] ORG-02 — Favoritos, notas, progreso, etiquetas y filtros combinables; persistencia tras reinicio. Evidencia: tests y qa-desktop.cjs.
- [ ] ORG-03 — Colecciones con gestión propia y asignación de juegos.
- [ ] ORG-04 — Flujo explícito para revisar/unir/separar duplicados y escoger lanzamiento, preservando tiendas y ediciones.
- [ ] ORG-05 — Validar búsqueda, filtros, rendimiento y estados vacíos con bibliotecas grandes y usuarios externos.

## 6. Datos, recuperación y sesiones

- [x] DATA-01 — Guardado ordenado, respaldo de biblioteca y rechazo de formatos futuros. Evidencia: pruebas de store y recuperación.
- [x] DATA-02 — Exportar/restaurar catálogo con portadas entre perfiles, sin sesiones. Evidencia: backup.test.cjs y qa-backup.cjs.
- [x] DATA-03 — Esperar guardados al salir y permitir reintento de fallo de escritura. Evidencia: qa-shutdown.cjs.
- [ ] DATA-04 — Completar transacciones y recuperación ante operaciones concurrentes, cierres forzados y cortes de energía.
- [ ] DATA-05 — Migraciones entre versiones y restauración grande cancelable, verificadas desde paquetes.
- [ ] DATA-06 — Auditoría de sesiones y ausencia de secretos en IPC, archivos exportados y registros por proveedor real.

## 7. Fichas, portadas y accesibilidad

- [x] UX-01 — Elegir portadas locales y conservarlas tras reiniciar. Evidencia: qa-desktop.cjs y qa-backup.cjs.
- [x] UX-02 — Fichas opcionales, idioma/región y actualización explícita del juego vinculado. Evidencia: qa-metadata-locale.cjs.
- [ ] UX-03 — Caché persistente de recursos remotos, límites de espacio, recuperación y recorrido completo sin red.
- [ ] UX-04 — Verificar condiciones y atribución de imágenes/fichas para distribución pública.
- [ ] UX-05 — Teclado, foco, lector de pantalla y escalados de Windows 100/125/150/200 %.
- [ ] UX-06 — Ayuda accionable ante proveedor caído, sesión vencida, archivo movido y error de datos; revisión externa de usabilidad.

## 8. Entrega, soporte y aceptación pública

- [x] REL-01 — Paquete ejecutable e instalador Next x64 independiente. Evidencia: alfa 5, hashes en RELEASE_ALPHA5.md; instalador no ejecutado.
- [x] REL-02 — Recorridos de escritorio, respaldo, cierre y fichas desde el paquete alfa 5. Evidencia: RELEASE_ALPHA5.md.
- [x] REL-03 — Diagnóstico local agregado sin datos privados del catálogo. Evidencia: qa-backup.cjs y diagnostics.test.cjs.
- [ ] REL-04 — Matriz Windows 10 x64 con candidato empaquetado. Evidencia requerida: WINDOWS_VALIDATION.md.
- [ ] REL-05 — Matriz completa Windows 11 x64 y usuario estándar, incluida instalación/desinstalación/reinstalación.
- [ ] REL-06 — Actualizador con recuperación y preservación de biblioteca, portadas y sesiones.
- [ ] REL-07 — Firma y canal de distribución; completar revisión de licencias y política de privacidad.
- [ ] REL-08 — Versiones de conectores en diagnóstico, documentación y canal de soporte. Versiones, ayuda integrada sin conexión y documentación SUPPORT.md implementadas. QA de apertura de URL fija aprobado sin enviar datos. Falta verificar disponibilidad del canal remoto: GitHub devolvió error de servicio el 13/09.
- [ ] REL-09 — Beta externa, corregir bloqueos y repetir aceptación sobre el mismo candidato.
- [ ] REL-10 — Auditoría final de todos los requisitos de PRODUCT_PLAN.md antes de publicar.

## Dependencias de validación y decisiones

Para pruebas reales, el usuario inicia sesión en la ventana del proveedor; no entrega contraseñas ni tokens. Falta confirmar cuentas disponibles y entorno Windows 10. Eso bloquea esas validaciones, no el desarrollo independiente.

No hay servidor propio incorporado. Si una función lo exige, explicar el motivo antes de incluirlo. La monetización se decidirá después de completar el producto; no se añade venta/activación como requisito de esta etapa.

## Últimos avances

- 13/09: qa-ea-session.cjs aprobado con servidor HTTPS local, solicitud real del renderer, captura y catálogo desde main. Confirma el mecanismo en Electron sin usar cuentas reales. No certifica todavía importación persistida ni habilita el botón EA.

- 13/09: adaptador EA y contexto de autenticación integrado al ciclo de vida de ventana. QA Electron de éxito/cierre/limpieza y regresión Battle.net aprobados; 111/111 pruebas unitarias. Falta probar el flujo completo EA antes de habilitarlo.

- 13/09: observador EA limitado a ventana y endpoint, cancelación y exclusión de observadores simultáneos; preparado y probado, todavía sin integrar al login. La plataforma continúa pendiente.

- 13/09: transporte EA conectado al lector, host fijo, bearer fuera de URLs, sin redirecciones, límites de 8 MiB/20 s y errores neutralizados. 107/107 pruebas aprobadas; autenticación y proveedor visible pendientes.

- 13/09: lector EA con validación de páginas, cuenta estable, recuentos y cancelación; 103/103 pruebas aprobadas. Fuente comunitaria fijada por commit y límites en EA_SUPPORT.md. No cierra la validación de plataforma ni habilita aún una conexión.

- 13/09: ONB-06 cerrada. Formulario conectado a borradores mediante useSetupDraft; QA con tres arranques aislados, descarte persistente y fallo de escritura/reintento con foco visible. Ajustado margen del título para no quedar oculto por la barra fija.

- 13/09: servicio de borradores separado del coordinador de onboarding; guarda elecciones sin aplicar ajustes, resultados de búsqueda ni sesiones. 99/99 pruebas aprobadas. ONB-06 sigue parcial hasta integrar la experiencia en la interfaz.

- 13/09: ayuda local en Ajustes, guía SUPPORT.md y enlace a issues sin envío automático. QA de teclado y modo sin conexión, respaldo y diagnóstico aprobados; 95/95 pruebas y build correctos. REL-08 sigue parcial por verificación remota pendiente.

- 13/09: diagnóstico v2 con versiones de los proveedores registrados, campos permitidos y error `unsupported-catalog`; pruebas de exportación sin datos privados. REL-08 sigue parcial.

- 13/09: roadmap actualizado con el alcance vigente y casillas por evidencia.
- 13/09: asociación Battle.net mediante UID exacto no ambiguo; pruebas en ambos órdenes de importación, conservando preferencias. No equivale a resolver duplicados históricos.
- 12/09: conector experimental Battle.net y lector limitado; pruebas controladas de conexión/sincronización/desconexión. No incluido en alfa 5.
- 12/09: alfa 5 generada y verificada localmente, sin instalar sobre Orbit estable.
