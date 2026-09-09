import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Switch,
  Divider,
} from "@mui/material";
import { FolderPlus, X, Download, Upload } from "lucide-react";
import AccountsPanel from "../accounts/AccountsPanel";
export default function SettingsDialog({
  open,
  onClose,
  settings,
  action,
  appName,
  version,
  onSetup,
  accounts,
}) {
  if (!settings) return null;
  const update = (patch) => action(() => window.orbit.settings(patch));
  const rows = [
    [
      "startWithWindows",
      "Abrir al iniciar Windows",
      "Entra directamente a tu biblioteca cuando inicies sesión.",
    ],
    [
      "autoScan",
      "Detectar juegos automáticamente",
      "Vigila tus carpetas y revisa los lanzadores cada 5 minutos mientras Orbit está abierto.",
    ],
    [
      "onlineMetadata",
      "Imágenes y fichas en línea",
      "Busca por nombre en la tienda pública de Steam. No necesita cuentas ni contraseñas.",
    ],
    [
      "closeToTray",
      "Seguir en la bandeja al cerrar",
      "Mantiene la detección activa. Puedes salir desde el icono junto al reloj.",
    ],
    [
      "minimizeOnLaunch",
      "Minimizar al abrir un juego",
      "Deja la pantalla libre para tu partida.",
    ],
  ];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Ajustes
        <p className="dialog-subtitle">
          Haz que Orbit se adapte a cómo juegas.
        </p>
      </DialogTitle>
      <DialogContent>
        <AccountsPanel accounts={accounts} />
        <Divider />
        <div className="form-section-heading">
          <h3>Configurar la detección</h3>
          <p>
            Revisa tus plataformas y busca ejecutables en otras carpetas. Las
            nuevas incorporaciones se confirman antes de guardarse.
          </p>
          <Button onClick={onSetup} startIcon={<FolderPlus size={18} />}>
            Revisar carpetas y juegos
          </Button>
        </div>
        {rows.map(([key, title, description]) => (
          <label className="setting-row" key={key}>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
            <Switch
              checked={!!settings[key]}
              onChange={(e) => update({ [key]: e.target.checked })}
              slotProps={{ input: { "aria-label": title } }}
            />
          </label>
        ))}
        <Divider />
        <div className="form-section-heading">
          <h3>Carpetas de accesos directos</h3>
          <p>
            Agrega accesos directos aquí y aparecerán en la biblioteca. Incluye
            las subcarpetas inmediatas.
          </p>
        </div>
        <div className="folder-list">
          {settings.folders.map((folder) => (
            <div key={folder}>
              <span title={folder}>{folder}</span>
              <button
                className="text-button"
                aria-label={`Dejar de vigilar ${folder}`}
                onClick={() =>
                  update({
                    folders: settings.folders.filter((p) => p !== folder),
                  })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button
          startIcon={<FolderPlus size={18} />}
          onClick={async () => {
            const folder = await action(() => window.orbit.pickFolder());
            if (folder) update({ folders: [...settings.folders, folder] });
          }}
        >
          Añadir carpeta
        </Button>
        <Divider sx={{ my: 2 }} />
        <div className="form-section-heading">
          <h3>Tu biblioteca, en tu PC</h3>
          <p>
            Guarda juegos, rutas, argumentos, favoritos, notas, fichas y
            portadas locales en una copia. No incluye los archivos de los juegos
            ni sesiones de cuentas. Al restaurar se conservan las cuentas y
            carpetas vigiladas actuales; revisa las rutas si cambias de PC.
          </p>
        </div>
        <div className="backup-actions">
          <Button
            color="inherit"
            startIcon={<Download size={17} />}
            onClick={() =>
              action(
                () => window.orbit.exportLibrary(),
                (result) =>
                  result ? "Respaldo guardado" : "Exportación cancelada",
              )
            }
          >
            Exportar biblioteca
          </Button>
          <Button
            color="inherit"
            startIcon={<Upload size={17} />}
            onClick={() =>
              action(
                () => window.orbit.importLibrary(),
                (result) =>
                  result === false
                    ? "Restauración cancelada"
                    : `Respaldo aplicado a ${result} juegos`,
              )
            }
          >
            Restaurar
          </Button>
        </div>
        <p className="settings-footer">
          {appName} · {version}
          <br />
          Steam, EA, Xbox y otras marcas pertenecen a sus respectivos
          propietarios. Orbit abre tus lanzadores y respeta sus requisitos de
          acceso.
        </p>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
