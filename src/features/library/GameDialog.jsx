import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  Divider,
} from "@mui/material";
import {
  FolderOpen,
  Search,
  ExternalLink,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { nameOf, playStatuses } from "./useLibrary";
export default function GameDialog({ open, onClose, game, action, onAdded }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm();
  const [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [searchBusy, setSearchBusy] = useState(false);
  useEffect(() => {
    if (open) {
      reset({
        name: game ? nameOf(game) : "",
        target: "",
        notes: game?.notes || "",
        statusOverride: game?.statusOverride || "auto",
        playStatus: game?.playStatus || "none",
        launchArguments: (game?.launchOptions?.args || []).join("\n"),
        workingDirectory: game?.launchOptions?.workingDirectory || "",
      });
      setQuery(game ? nameOf(game) : "");
      setResults(null);
    }
  }, [open, game?.id, reset]);
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    const done = await action(
      async () => {
        const launchOptions = {
          args: (values.launchArguments || "")
            .split(/\r?\n/)
            .filter((line) => line.length > 0),
          workingDirectory: values.workingDirectory || "",
        };
        if (game) {
          await window.orbit.updateGame(game.id, {
            customName: values.name,
            notes: values.notes,
            playStatus: values.playStatus,
            statusOverride: values.statusOverride,
            target: values.target,
            launchOptions,
          });
        } else {
          const id = await window.orbit.addGame({
            playStatus: values.playStatus,
            name: values.name,
            target: values.target,
            launchOptions,
          });
          onAdded(id);
        }
        return true;
      },
      game ? "Cambios guardados" : "Juego agregado a tu biblioteca",
    );
    setBusy(false);
    if (done) onClose();
  });
  const choose = async () => {
    const target = await action(() => window.orbit.pickFile());
    if (target) {
      setValue("target", target, { shouldValidate: true });
      if (!watch("name"))
        setValue(
          "name",
          target
            .split(/[\\/]/)
            .at(-1)
            .replace(/\.(exe|lnk|url)$/i, ""),
        );
    }
  };
  const search = async () => {
    setSearchBusy(true);
    const response = await action(() => window.orbit.metadataSearch(query));
    if (response) setResults(response);
    setSearchBusy(false);
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={submit}>
        <DialogTitle>
          {game ? "Tu juego, a tu manera" : "Añadir un juego"}
          <p className="dialog-subtitle">
            {game
              ? "Ajusta sus datos, el acceso y la imagen de su ficha."
              : "Selecciona un ejecutable o un acceso directo de Windows."}
          </p>
        </DialogTitle>
        <DialogContent className="form-content">
          <TextField
            label="Mi progreso"
            select
            fullWidth
            value={watch("playStatus") || "none"}
            onChange={(event) => setValue("playStatus", event.target.value)}
            helperText="Tu organización personal. No cambia la instalación ni los logros del juego."
          >
            {Object.entries(playStatuses).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Nombre del juego"
            fullWidth
            {...register("name", { required: "Escribe el nombre del juego" })}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
          <div className="path-field">
            <TextField
              label={
                game
                  ? "Cambiar ruta o enlace (opcional)"
                  : "Ruta o enlace del lanzador"
              }
              fullWidth
              {...register("target", {
                required: game
                  ? false
                  : "Selecciona un ejecutable o acceso directo",
              })}
              error={!!errors.target}
              helperText={
                errors.target?.message ||
                "Archivos .exe, .lnk, .url o enlaces de Steam, Epic, EA y Ubisoft."
              }
            />
            <Button
              variant="outlined"
              onClick={choose}
              aria-label="Elegir archivo"
            >
              <FolderOpen size={19} />
            </Button>
          </div>
          <details>
            <summary>Opciones del ejecutable o lanzador propio</summary>
            <p className="muted">
              Para archivos .exe. Deja estos campos vacíos si el juego no
              necesita una configuración especial.
            </p>
            <TextField
              label="Argumentos de inicio"
              fullWidth
              multiline
              minRows={2}
              helperText="Un argumento por línea. Las rutas con espacios van en una sola línea, sin comillas adicionales."
              {...register("launchArguments")}
            />
            <div className="path-field">
              <TextField
                label="Carpeta de trabajo"
                fullWidth
                {...register("workingDirectory")}
                helperText="Vacía: se usa la carpeta del ejecutable."
              />
              <Button
                variant="outlined"
                aria-label="Elegir carpeta de trabajo"
                onClick={async () => {
                  const folder = await action(() => window.orbit.pickFolder());
                  if (folder) setValue("workingDirectory", folder);
                }}
              >
                <FolderOpen size={19} />
              </Button>
            </div>
          </details>
          {game && (
            <>
              <TextField
                select
                label="Estado de instalación"
                fullWidth
                value={watch("statusOverride") || "auto"}
                {...register("statusOverride")}
              >
                <MenuItem value="auto">Automático (recomendado)</MenuItem>
                <MenuItem value="installed">
                  Instalado · indicar manualmente
                </MenuItem>
                <MenuItem value="uninstalled">
                  No instalado · indicar manualmente
                </MenuItem>
                <MenuItem value="unknown">Sin verificar</MenuItem>
              </TextField>
              <Alert severity="info" icon={false}>
                {game.statusReason}
              </Alert>
              <TextField
                label="Mis notas"
                fullWidth
                multiline
                minRows={2}
                placeholder="Partida pendiente, mods, recordatorios…"
                {...register("notes")}
              />
              <Divider />
              <div className="form-section-heading">
                <h3>Imagen y datos del juego</h3>
                <p>
                  Vincula una ficha pública de Steam. Esto no cambia el lanzador
                  ni la propiedad del juego.
                </p>
              </div>
              <div className="path-field">
                <TextField
                  label="Buscar ficha"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      search();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={search}
                  disabled={searchBusy || query.length < 2}
                  aria-label="Buscar ficha"
                >
                  <Search size={18} />
                </Button>
              </div>
              {searchBusy && <p className="muted">Buscando fichas…</p>}
              {results?.length === 0 && (
                <Alert severity="info">
                  No hay coincidencias. Prueba con el nombre original del juego.
                </Alert>
              )}
              <div className="metadata-results">
                {results?.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={async () => {
                      setBusy(true);
                      await action(
                        () => window.orbit.metadataApply(game.id, result.id),
                        "Ficha e imágenes actualizadas",
                      );
                      setBusy(false);
                      setResults(null);
                    }}
                    disabled={busy}
                  >
                    <img src={result.image} alt="" />
                    <span>{result.name}</span>
                    <ExternalLink size={15} />
                  </button>
                ))}
              </div>
              {game.metadata && (
                <div className="metadata-info">
                  <span>{game.metadata.developers.join(", ")}</span>
                  <span>{game.metadata.genres.join(" · ")}</span>
                  {game.metadata.score && (
                    <span>Metacritic: {game.metadata.score}/100</span>
                  )}
                </div>
              )}
              <div className="backup-actions">
                <Button
                  startIcon={<FolderOpen size={16} />}
                  onClick={() =>
                    action(
                      () => window.orbit.chooseArtwork(game.id),
                      (result) =>
                        result
                          ? "Imagen del juego actualizada"
                          : "Selección cancelada",
                    )
                  }
                >
                  Usar una imagen de mi PC
                </Button>
                {game.artworkRevision && (
                  <Button
                    color="inherit"
                    onClick={() =>
                      action(
                        () => window.orbit.clearArtwork(game.id),
                        "Imagen automática restaurada",
                      )
                    }
                  >
                    Restaurar imagen automática
                  </Button>
                )}
              </div>
              <Button
                color="inherit"
                startIcon={
                  game.hidden ? <RotateCcw size={16} /> : <EyeOff size={16} />
                }
                onClick={async () => {
                  await action(
                    () =>
                      window.orbit.updateGame(game.id, {
                        hidden: !game.hidden,
                      }),
                    game.hidden
                      ? "Juego restaurado"
                      : "Juego oculto. Puedes recuperarlo en Ocultos.",
                  );
                  onClose();
                }}
              >
                {game.hidden
                  ? "Restaurar en biblioteca"
                  : "Ocultar de mi biblioteca"}
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy
              ? "Guardando…"
              : game
                ? "Guardar cambios"
                : "Añadir a mi biblioteca"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
