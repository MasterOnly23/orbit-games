import { Button, Stack, Typography } from "@mui/material";

const topics = [
  [
    "No aparece un juego",
    "Repite el asistente desde Ajustes para revisar las carpetas de accesos y otras carpetas de juegos. Si sigue sin aparecer, usa Añadir juego y elige su ejecutable o acceso directo. No hace falta conectar una cuenta para añadir un juego local.",
  ],
  [
    "Instalado, no instalado o sin verificar",
    "El catálogo de una cuenta y la instalación en este PC son distintos. Sin verificar puede indicar un disco desconectado, falta de permisos o que solo encontramos un lanzador compartido. Reconecta la unidad y vuelve a detectar; puedes revisar la ruta y el estado desde Editar juego.",
  ],
  [
    "El juego no abre",
    "Comprueba que abre desde su lanzador original y que la sesión del proveedor está activa. En Editar juego revisa el acceso, los argumentos y la carpeta de trabajo. Para juegos que requieren opciones de Windows, selecciona un acceso directo configurado. Detectar un archivo no garantiza que su DRM, anticheat o instalación funcionen.",
  ],
  [
    "La conexión de una plataforma falla",
    "Revisa Cobertura por plataforma en Cuentas. Si la sesión venció, desconecta y vuelve a conectar; Orbit conserva los juegos importados. Ante un límite de consultas, espera antes de sincronizar otra vez. No compartas contraseñas, códigos de segundo factor ni archivos de sesión para pedir ayuda.",
  ],
  [
    "Falta una portada o la ficha es incorrecta",
    "En Editar juego puedes elegir una imagen local. Para datos en línea, activa las fichas en Ajustes, busca el título correcto y selecciónalo. Actualizar ficha consulta de nuevo el juego vinculado con tu idioma y región. Las consultas en línea requieren Internet; las imágenes locales y la biblioteca pueden usarse sin conexión.",
  ],
  [
    "Cambiar de PC o recuperar una biblioteca",
    "Usa Exportar biblioteca en Ajustes y guarda la copia en otro lugar. Restaurar incluye juegos y portadas, pero no archivos de juegos ni sesiones de cuentas. En otro PC revisa las rutas y conecta las cuentas otra vez. Exportar diagnóstico es distinto: sirve para investigar fallos y no permite restaurar juegos.",
  ],
];

export default function HelpPanel({ action }) {
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography component="h3" variant="subtitle1">
        Ayuda y soporte
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Esta ayuda está incluida en Orbit y se puede leer sin conexión.
      </Typography>
      {topics.map(([title, body]) => (
        <details key={title}>
          <summary>{title}</summary>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {body}
          </Typography>
        </details>
      ))}
      <Typography variant="body2" color="text.secondary">
        Para reportar un problema, indica los pasos, lo que esperabas y lo que
        ocurrió. Puedes exportar y revisar el diagnóstico antes de adjuntarlo.
        Los reportes del repositorio son públicos; evita rutas personales y
        datos de cuentas en textos o capturas. El botón abre GitHub y no envía
        ni adjunta nada.
      </Typography>
      <Button
        variant="outlined"
        onClick={() => action(() => window.orbit.openSupport())}
      >
        Abrir reportes en GitHub
      </Button>
    </Stack>
  );
}
