import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { FolderPlus, ArrowRight, CheckCircle2, X, Search } from "lucide-react";
import "./setup.css";

export default function SetupWizard({ settings, onComplete, onCancel }) {
  const [folders, setFolders] = useState(settings.folders || []);
  const [gameFolders, setGameFolders] = useState(settings.gameFolders || []);
  const [suggestions, setSuggestions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [online, setOnline] = useState(!!settings.onlineMetadata);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    window.orbit
      .setupSuggestions()
      .then((items) => {
        if (active) setSuggestions(items);
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudieron sugerir carpetas. Puedes añadirlas manualmente.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(work) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
    } finally {
      setBusy(false);
    }
  }
  const addFolder = (setter) =>
    run(async () => {
      const folder = await window.orbit.pickFolder();
      if (folder)
        setter((current) =>
          current.some((p) => p.toLowerCase() === folder.toLowerCase())
            ? current
            : [...current, folder],
        );
    });
  const folderList = (items, setter) => (
    <ul className="setup-folders">
      {items.map((folder) => (
        <li key={folder}>
          <span>{folder}</span>
          <button
            type="button"
            disabled={busy}
            aria-label={`Quitar ${folder}`}
            onClick={() => setter(items.filter((p) => p !== folder))}
          >
            <X size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <main className="setup-page">
      <div className="setup-titlebar">ORBIT GAMES NEXT</div>
      <div className="setup-container">
        <header className="setup-heading">
          <span className="setup-badge">
            ORBIT GAMES NEXT · VERSIÓN DE PRUEBA
          </span>
          <h1>
            {preview ? "Revisa tu biblioteca" : "Tus juegos empiezan aquí"}
          </h1>
          <p>
            {preview
              ? "Comprueba lo encontrado antes de incorporarlo a esta biblioteca."
              : "Encuentra tus juegos en este PC. Esta versión tiene su propia biblioteca, independiente de Orbit Games."}
          </p>
          <ol className="setup-steps" aria-label="Pasos de configuración">
            <li aria-current={!preview ? "step" : undefined}>
              1 · Dónde buscar
            </li>
            <li aria-current={preview ? "step" : undefined}>
              2 · Revisar y guardar
            </li>
          </ol>
        </header>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!preview ? (
          <>
            <section className="setup-panel">
              <h2>Plataformas detectadas automáticamente</h2>
              <p>
                Buscaremos instalaciones registradas de Steam, Epic, Xbox y
                otros lanzadores, también en sus bibliotecas de otros discos.
              </p>
              <p className="setup-note">
                Esta primera versión detecta juegos locales. La conexión con
                cuentas para consultar juegos no instalados llegará en una etapa
                posterior.
              </p>
            </section>
            <section className="setup-panel">
              <h2>Carpetas con accesos directos</h2>
              <p>
                Selecciona dónde guardas accesos a tus juegos. Revisaremos esa
                carpeta y sus subcarpetas inmediatas.
              </p>
              {suggestions
                .filter((p) => !folders.includes(p))
                .map((folder) => (
                  <Button
                    key={folder}
                    disabled={busy}
                    onClick={() => setFolders([...folders, folder])}
                    size="small"
                  >
                    Añadir {folder}
                  </Button>
                ))}
              {folderList(folders, setFolders)}
              <Button
                disabled={busy}
                startIcon={<FolderPlus size={17} />}
                onClick={() => addFolder(setFolders)}
              >
                Elegir carpeta de accesos
              </Button>
            </section>
            <section className="setup-panel">
              <h2>Otras carpetas de juegos</h2>
              <p>
                Para juegos portables o instalaciones que no aparecen en un
                lanzador. Tú elegirás qué ejecutables añadir; no se abrirá
                ninguno durante la búsqueda.
              </p>
              {folderList(gameFolders, setGameFolders)}
              <Button
                disabled={busy}
                startIcon={<FolderPlus size={17} />}
                onClick={() => addFolder(setGameFolders)}
              >
                Elegir carpeta de juegos
              </Button>
              <p className="setup-note">
                Hasta tres niveles de subcarpetas. Si no aparece un juego,
                selecciona una carpeta más específica o añádelo manualmente
                después.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="setup-panel">
              <h2>
                <CheckCircle2 size={21} /> {preview.count} juegos detectados
              </h2>
              {preview.count ? (
                <div className="setup-platforms">
                  {preview.platforms.map((p) => (
                    <span key={p.name}>
                      {p.name}
                      <b>{p.count}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <p>
                  No encontramos instalaciones registradas. Puedes guardar una
                  biblioteca vacía y añadir tus juegos después.
                </p>
              )}
              {!!preview.locations.length && (
                <details>
                  <summary>
                    Ver carpetas de instalación ({preview.locations.length})
                  </summary>
                  <ul className="setup-locations">
                    {preview.locations.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.warnings.map((warning, index) => (
                <Alert
                  severity="warning"
                  key={`${index}:${warning}`}
                  sx={{ mt: 1 }}
                >
                  {warning}
                </Alert>
              ))}
            </section>
            <section className="setup-panel">
              <h2>
                Ejecutables para revisar{" "}
                <span className="setup-count">{preview.candidates.length}</span>
              </h2>
              <p>
                Marca solo el archivo que inicia cada juego. Los nombres vienen
                de los archivos y puedes corregirlos después desde Editar.
              </p>
              {!preview.candidates.length ? (
                <p className="setup-note">
                  No hay ejecutables adicionales pendientes en las carpetas
                  seleccionadas.
                </p>
              ) : (
                <div className="setup-candidates">
                  {preview.candidates.map((candidate) => (
                    <label key={candidate.id} className="setup-candidate">
                      <Checkbox
                        disabled={busy}
                        checked={selected.includes(candidate.id)}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, candidate.id]
                              : old.filter((id) => id !== candidate.id),
                          )
                        }
                        slotProps={{
                          input: { "aria-label": `Añadir ${candidate.name}` },
                        }}
                      />
                      <span>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.target}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>
            <section className="setup-panel">
              <FormControlLabel
                control={
                  <Switch
                    disabled={busy}
                    checked={online}
                    onChange={(e) => setOnline(e.target.checked)}
                  />
                }
                label="Consultar portadas y fichas en línea"
              />
              <p className="setup-note">
                Envía nombres e identificadores de juegos a Steam para buscar
                coincidencias. Puedes cambiar esta opción en Ajustes.
              </p>
            </section>
          </>
        )}
        <footer className="setup-actions">
          <div>
            {busy && (
              <span role="status">
                <CircularProgress size={18} />{" "}
                {preview
                  ? "Guardando tu biblioteca…"
                  : "Revisando las carpetas y los lanzadores…"}
              </span>
            )}
          </div>
          <div className="setup-buttons">
            {onCancel && (
              <Button disabled={busy} color="inherit" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            {preview && (
              <Button
                disabled={busy}
                color="inherit"
                onClick={() => {
                  setPreview(null);
                  setSelected([]);
                }}
              >
                Volver
              </Button>
            )}
            <Button
              variant="contained"
              disabled={busy}
              endIcon={
                preview ? <ArrowRight size={18} /> : <Search size={18} />
              }
              onClick={() =>
                run(async () => {
                  if (!preview) {
                    setPreview(
                      await window.orbit.setupPreview({ folders, gameFolders }),
                    );
                    setSelected([]);
                  } else {
                    await window.orbit.setupComplete({
                      previewId: preview.id,
                      selectedCandidates: selected,
                      onlineMetadata: online,
                    });
                    onComplete();
                  }
                })
              }
            >
              {preview ? "Guardar y abrir biblioteca" : "Buscar juegos"}
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
