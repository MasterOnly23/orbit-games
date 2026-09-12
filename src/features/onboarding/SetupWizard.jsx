import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, CircularProgress } from "@mui/material";
import { FolderPlus, ArrowRight, CheckCircle2, X, Search } from "lucide-react";
import "./setup.css";
import AccountsPanel from "../accounts/AccountsPanel";
import SetupMetadata from "./SetupMetadata";

export default function SetupWizard({
  settings,
  accounts,
  onComplete,
  onCancel,
}) {
  const [showAccounts, setShowAccounts] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [folders, setFolders] = useState(settings.folders || []);
  const [gameFolders, setGameFolders] = useState(settings.gameFolders || []);
  const [suggestions, setSuggestions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [online, setOnline] = useState(!!settings.onlineMetadata);
  const [language, setLanguage] = useState(
    settings.metadataLanguage || "spanish",
  );
  const [country, setCountry] = useState(settings.metadataCountry || "");
  const validLocale = /^(?:[A-Z]{2})?$/.test(country);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState("");
  const heading = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    heading.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, [preview?.id, showAccounts]);
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
    setNotice("");
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
          <h1 ref={heading} tabIndex={-1}>
            {showAccounts
              ? "Tus cuentas, si las necesitas"
              : preview
                ? "Revisa tu biblioteca"
                : "Tus juegos empiezan aquí"}
          </h1>
          <p>
            {showAccounts
              ? "Este paso es opcional. Puedes usar Orbit con tus juegos locales y conectar cuentas más adelante."
              : preview
                ? "Comprueba lo encontrado antes de incorporarlo a esta biblioteca."
                : "Encuentra tus juegos en este PC. Esta versión tiene su propia biblioteca, independiente de Orbit Games."}
          </p>
          <ol className="setup-steps" aria-label="Pasos de configuración">
            <li aria-current={!preview ? "step" : undefined}>
              1 · Dónde buscar
            </li>
            <li aria-current={preview && !showAccounts ? "step" : undefined}>
              2 · Revisar juegos
            </li>
            <li aria-current={showAccounts ? "step" : undefined}>
              3 · Cuentas opcionales
            </li>
          </ol>
        </header>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {notice}
          </Alert>
        )}
        {showAccounts ? (
          <section className="setup-panel">
            <AccountsPanel accounts={accounts} onBusyChange={setConnecting} />
            <p className="setup-note">
              Las cuentas que conectes se guardan al completar su
              sincronización. Volver al paso anterior conserva esas conexiones.
            </p>
          </section>
        ) : !preview ? (
          <>
            <section className="setup-panel">
              <h2>Plataformas detectadas automáticamente</h2>
              <p>
                Buscaremos instalaciones registradas de Steam, Epic, Xbox y
                otros lanzadores, también en sus bibliotecas de otros discos.
              </p>
              <p className="setup-note">
                Puedes agregar juegos sin plataforma y lanzadores propios. Al
                final podrás conectar cuentas para consultar también tu
                biblioteca en línea.
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
            <SetupMetadata
              online={online}
              onOnline={setOnline}
              language={language}
              onLanguage={setLanguage}
              country={country}
              onCountry={setCountry}
              busy={busy}
            />
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
            {searching && (
              <Button
                disabled={stopping}
                color="inherit"
                onClick={async () => {
                  setStopping(true);
                  try {
                    await window.orbit.cancelSetup();
                  } catch {
                    setError(
                      "No se pudo detener la búsqueda. Inténtalo de nuevo.",
                    );
                    setStopping(false);
                  }
                }}
              >
                {stopping ? "Deteniendo…" : "Detener búsqueda"}
              </Button>
            )}
            {onCancel && (
              <Button
                disabled={busy || connecting}
                color="inherit"
                onClick={onCancel}
              >
                Cancelar
              </Button>
            )}
            {preview && (
              <Button
                disabled={busy || connecting}
                color="inherit"
                onClick={() => {
                  if (showAccounts) {
                    setShowAccounts(false);
                    return;
                  }
                  setPreview(null);
                  setSelected([]);
                }}
              >
                Volver
              </Button>
            )}
            <Button
              variant="contained"
              disabled={busy || connecting || !validLocale}
              endIcon={
                preview ? <ArrowRight size={18} /> : <Search size={18} />
              }
              onClick={() =>
                run(async () => {
                  if (!preview) {
                    setSearching(true);
                    try {
                      const result = await window.orbit.setupPreview({
                        folders,
                        gameFolders,
                      });
                      if (result.cancelled)
                        setNotice(
                          "Búsqueda detenida. Puedes ajustar las carpetas y volver a buscar. No se guardaron juegos.",
                        );
                      else {
                        setPreview(result);
                        setSelected([]);
                      }
                    } finally {
                      setSearching(false);
                      setStopping(false);
                    }
                  } else if (!showAccounts) {
                    setShowAccounts(true);
                  } else {
                    await window.orbit.setupComplete({
                      previewId: preview.id,
                      selectedCandidates: selected,
                      onlineMetadata: online,
                      metadataLanguage: language,
                      metadataCountry: country,
                    });
                    onComplete();
                  }
                })
              }
            >
              {showAccounts
                ? "Guardar y abrir biblioteca"
                : preview
                  ? "Continuar a cuentas"
                  : "Buscar juegos"}
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
