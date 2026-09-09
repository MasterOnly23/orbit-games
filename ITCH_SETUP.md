# itch.io: registro y validación pendientes

El conector está implementado para desarrollo, pero no cuenta todavía como conexión pública validada. No se ha registrado una aplicación OAuth de Orbit ni probado una cuenta real.

## Registro del producto

- Crear una aplicación para Orbit en https://itch.io/user/settings/oauth-apps.
- Callback previsto: `http://127.0.0.1:43817/orbit/itch/callback`.
- Permisos solicitados: `profile:me profile:owned`, de lectura.
- El identificador de cliente es público. No compartir contraseñas, API keys personales, tokens ni secretos en el chat o en Git.
- Para pruebas de desarrollo, definir `ORBIT_ITCH_CLIENT_ID` con el identificador registrado antes de arrancar Next. Sin una configuración válida el botón no aparece. El candidato público deberá incluir el identificador de Orbit; no se pretende que cada usuario registre una aplicación ni configure variables.

La implementación utiliza código de autorización con PKCE y un estado aleatorio por conexión. La ventana aislada intercepta el callback local antes de navegar; no abre un servidor HTTP ni requiere infraestructura propia. Esta variante debe comprobarse contra la web real y el registro del proveedor antes de distribuirla.

## Cobertura actual y límites

- Consulta paginada de accesos comprados o reclamados asociados a la cuenta. No confunde juegos publicados por el usuario con su biblioteca adquirida.
- Descarta claves de descarga, datos privados de pedidos y campos ajenos al catálogo. Credenciales en el almacén cifrado de Next.
- Renovación de tokens e identidad comprobada con el perfil. Fallos o páginas inconsistentes conservan la biblioteca anterior.
- Los elementos identificados como herramientas u otro contenido no lúdico se excluyen. La compatibilidad Windows se indica como no verificada.
- No instala ni descarga juegos; ofrece la biblioteca web. Falta detección específica de instalaciones de itch, cobertura de bundles y validación de cuentas reales.
- Una cuenta guardada se puede desconectar aunque su conector deje de estar configurado.

## Evidencia y comprobaciones pendientes

`tests/itch.test.cjs` prueba PKCE, callback exacto, paginación, exclusión de claves, renovación, errores e identidad. `scripts/qa-itch.cjs` usa respuestas controladas en Electron para conexión, callback, almacenamiento cifrado, sincronización y desconexión. Esto no acredita aceptación de los permisos por itch.io.

Antes de habilitar públicamente: registrar Orbit, verificar que el flujo de código admite esos permisos, probar login/segundo factor, biblioteca real y sus límites, expiración, revocación, reinicio, cancelación y ambos Windows objetivo. La rotación se guarda antes de consultar el perfil para permitir reintentos si esa consulta falla; una prueba automatizada cubre ese caso.

Fuentes primarias consultadas el 9 de septiembre de 2026: [OAuth](https://itch.io/docs/api/oauth), [API](https://itch.io/docs/api/serverside), [guía actual para lanzadores](https://github.com/itchio/butler/blob/master/docs/launcher-integration.md) y [cliente oficial go-itchio](https://github.com/itchio/go-itchio/tree/97b89cda676c40b3df632369fc53dd72d722f922). La página general describe OAuth implícito; la guía y el código actuales incluyen PKCE y renovación. Esa diferencia exige validación real, no asumir equivalencia.
