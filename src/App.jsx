import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Snackbar, Button } from "@mui/material";
import {
  Orbit,
  Library,
  Download,
  Star,
  History,
  Settings,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  Gamepad2,
  ArrowUpRight,
  EyeOff,
  Shuffle,
  Monitor,
  CheckCircle2,
} from "lucide-react";
import { useLibrary, nameOf, statusOf } from "./features/library/useLibrary";
import GameCard from "./features/library/GameCard";
import GameHero from "./features/library/GameHero";
import GameDialog from "./features/library/GameDialog";
import SettingsDialog from "./features/settings/SettingsDialog";
import SetupWizard from "./features/onboarding/SetupWizard";
const labels = {
  all: "Tu biblioteca",
  installed: "Listos para jugar",
  favorites: "Tus favoritos",
  recent: "Jugados recientemente",
  hidden: "Juegos ocultos",
};
export default function App() {
  const { library, error, setError, toast, setToast, action } = useLibrary();
  const [view, setView] = useState("all"),
    [provider, setProvider] = useState("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(
      localStorage.getItem("orbit-selected") || "",
    ),
    [dialog, setDialog] = useState(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [setupOpen, setSetupOpen] = useState(false),
    [launching, setLaunching] = useState(false);
  const searchRef = useRef();
  useEffect(() => {
    const listener = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const games = library?.games || [];
  const visible = games.filter((g) => !g.hidden);
  const providers = useMemo(
    () =>
      [
        ...new Set(games.filter((g) => !g.hidden).map((g) => g.provider)),
      ].sort(),
    [games],
  );
  const filtered = useMemo(
    () =>
      games
        .filter((g) => (view === "hidden" ? g.hidden : !g.hidden))
        .filter((g) => view !== "installed" || statusOf(g) === "installed")
        .filter((g) => view !== "favorites" || g.favorite)
        .filter((g) => view !== "recent" || g.lastPlayed)
        .filter((g) => provider === "all" || g.provider === provider)
        .filter((g) => filter === "all" || statusOf(g) === filter)
        .filter((g) =>
          nameOf(g)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes(
              query
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase(),
            ),
        )
        .sort((a, b) =>
          sort === "recent" || view === "recent"
            ? (Date.parse(b.lastPlayed || 0) || 0) -
              (Date.parse(a.lastPlayed || 0) || 0)
            : sort === "added"
              ? Date.parse(b.addedAt) - Date.parse(a.addedAt)
              : nameOf(a).localeCompare(nameOf(b), "es"),
        ),
    [games, view, provider, filter, query, sort],
  );
  const selectedGame =
    filtered.find((g) => g.id === selected) ||
    filtered.find((g) => statusOf(g) === "installed" && g.steamId) ||
    filtered[0];
  useEffect(() => {
    if (
      selectedGame &&
      !selectedGame.metadata &&
      library?.settings.onlineMetadata
    )
      window.orbit.metadataRefresh(selectedGame.id).catch(() => {});
  }, [selectedGame?.id, library?.settings.onlineMetadata]);
  function select(id) {
    setSelected(id);
    localStorage.setItem("orbit-selected", id);
  }
  function navigate(next, source = "all") {
    setView(next);
    setProvider(source);
    setFilter("all");
    setQuery("");
  }
  const favorite = (g) =>
    action(() => window.orbit.updateGame(g.id, { favorite: !g.favorite }));
  const play = async () => {
    if (!selectedGame) return;
    setLaunching(true);
    await action(
      () =>
        statusOf(selectedGame) === "uninstalled"
          ? window.orbit.openLauncher(selectedGame.id)
          : window.orbit.launch(selectedGame.id),
      statusOf(selectedGame) === "uninstalled"
        ? ["Humble Bundle", "GOG"].includes(selectedGame.provider)
          ? "Biblioteca web abierta"
          : "Lanzador abierto"
        : `Inicio solicitado: ${nameOf(selectedGame)}`,
    );
    setLaunching(false);
  };
  if (library && (!library.onboarding?.completedAt || setupOpen))
    return (
      <SetupWizard
        accounts={library.accounts}
        settings={library.settings}
        onComplete={() => setSetupOpen(false)}
        onCancel={
          library.onboarding?.completedAt
            ? () => setSetupOpen(false)
            : undefined
        }
      />
    );
  return (
    <div className="app-shell">
      <div className="titlebar">
        <Orbit size={13} />
        <span>ORBIT GAMES NEXT · PRUEBA</span>
        <span className="titlebar-separator">/</span>
        <span>Tu universo de juegos</span>
      </div>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Orbit size={28} />
          </div>
          <div>
            orbit<span>GAMES NEXT</span>
          </div>
        </div>
        <div className="nav-label">TU ESPACIO</div>
        <nav className="main-nav">
          {[
            ["all", Library, "Biblioteca", visible.length],
            [
              "installed",
              Download,
              "Instalados",
              visible.filter((g) => statusOf(g) === "installed").length,
            ],
            [
              "favorites",
              Star,
              "Favoritos",
              visible.filter((g) => g.favorite).length,
            ],
            ["recent", History, "Recientes", null],
          ].map(([key, Icon, label, count]) => (
            <button
              key={key}
              className={view === key && provider === "all" ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count !== null && <b>{count}</b>}
            </button>
          ))}
        </nav>
        <div className="nav-label launcher-label">
          PLATAFORMAS<span>{providers.length}</span>
        </div>
        <nav className="provider-nav">
          {providers.map((p) => (
            <button
              key={p}
              className={provider === p ? "active" : ""}
              onClick={() => navigate("all", p)}
            >
              <i className={`provider-dot ${p.replaceAll(" ", "-")}`} />
              <span>{p}</span>
              <span className="platform-count">
                {visible.filter((g) => g.provider === p).length}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="live-dot" />
            <span>
              Tu biblioteca está en este PC
              <small>Cuentas opcionales. A tu manera.</small>
            </span>
          </div>
          <button
            className={view === "hidden" ? "text-button active" : "text-button"}
            onClick={() => navigate("hidden")}
          >
            <EyeOff size={16} />
            Ocultos
          </button>
          <button
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
            Ajustes
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <span>Mi espacio</span>
            <span>/</span>
            <strong>{provider === "all" ? "Biblioteca" : provider}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                ref={searchRef}
                placeholder="Buscar un juego…"
                aria-label="Buscar un juego"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>Ctrl K</kbd>
            </label>
            <button
              className={`button scan-button ${library?.scanning ? "scanning" : ""}`}
              onClick={() =>
                action(() => window.orbit.scan(), "Biblioteca actualizada")
              }
              disabled={library?.scanning}
              title="Detectar juegos nuevos"
              aria-label="Detectar juegos nuevos"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="button add-button"
              onClick={() => setDialog("add")}
            >
              <Plus size={17} />
              Añadir juego
            </button>
          </div>
        </header>
        <div className="main-scroll">
          {!library ? (
            <div className="initial-loading">
              <Orbit size={48} />
              <h1>Preparando tu universo</h1>
              <p>Buscando tu biblioteca de juegos…</p>
            </div>
          ) : (
            <>
              {library.discovery?.candidates?.length > 0 && (
                <Alert
                  severity="info"
                  sx={{ m: 2 }}
                  action={
                    <Button color="inherit" onClick={() => setSetupOpen(true)}>
                      Revisar
                    </Button>
                  }
                >
                  Encontramos {library.discovery.candidates.length} posibles
                  juegos nuevos en tus carpetas. Revisa los ejecutables antes de
                  agregarlos.
                </Alert>
              )}
              {selectedGame && view !== "hidden" && (
                <GameHero
                  game={selectedGame}
                  online={library.settings.onlineMetadata}
                  onPlay={play}
                  onFavorite={() => favorite(selectedGame)}
                  onEdit={() => setDialog(selectedGame.id)}
                  onReveal={() =>
                    action(() => window.orbit.reveal(selectedGame.id))
                  }
                  onSource={() =>
                    action(() => window.orbit.openSource(selectedGame.id))
                  }
                  launching={launching}
                />
              )}
              <section className="library-section">
                <div className="library-heading">
                  <div>
                    <div className="section-eyebrow">
                      TODOS TUS MUNDOS. UN SOLO LUGAR.
                    </div>
                    <h2>
                      {provider === "all" ? labels[view] : provider}
                      <span>{filtered.length}</span>
                    </h2>
                  </div>
                  <div className="library-tools">
                    <button
                      className="text-button surprise-button"
                      title="Elegir un juego instalado al azar"
                      onClick={() => {
                        const ready = filtered.filter(
                          (g) => statusOf(g) === "installed",
                        );
                        if (ready.length)
                          select(
                            ready[Math.floor(Math.random() * ready.length)].id,
                          );
                        else
                          setToast(
                            "No hay juegos instalados en esta selección.",
                          );
                      }}
                    >
                      <Shuffle size={16} />
                      Sorpréndeme
                    </button>
                    <label className="sort-control">
                      <span>Ordenar:</span>
                      <select
                        aria-label="Ordenar juegos"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="name">Nombre A–Z</option>
                        <option value="recent">Última partida</option>
                        <option value="added">Recién agregados</option>
                      </select>
                      <ChevronDown size={13} />
                    </label>
                  </div>
                </div>
                <div className="library-filterbar">
                  <div className="filter-pills">
                    {[
                      ["all", "Todos"],
                      ["installed", "Instalados"],
                      ["uninstalled", "No instalados"],
                      ["unknown", "Sin verificar"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={filter === key ? "active" : ""}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="sync-status">
                    <span
                      className={
                        library.scanning ? "live-dot pulse" : "live-dot"
                      }
                    />
                    {library.scanning
                      ? "Detectando juegos…"
                      : library.scannedAt
                        ? `Actualizado ${new Date(library.scannedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
                        : "Listo para detectar"}
                  </span>
                </div>
                {library.warnings?.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {library.warnings.join(" ")}
                  </Alert>
                )}
                {filtered.length ? (
                  <div className="game-grid">
                    {filtered.map((g) => (
                      <GameCard
                        key={g.id}
                        online={library.settings.onlineMetadata}
                        game={g}
                        selected={g.id === selectedGame?.id}
                        onSelect={() =>
                          view === "hidden" ? setDialog(g.id) : select(g.id)
                        }
                        onFavorite={() => favorite(g)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Gamepad2 size={46} strokeWidth={1} />
                    <h3>
                      {library.scanning
                        ? "Buscando juegos en tu PC…"
                        : query
                          ? "No encontramos ese juego"
                          : view === "favorites"
                            ? "Tus favoritos empiezan aquí"
                            : view === "recent"
                              ? "Tu próxima partida aparece aquí"
                              : "Este espacio está listo para tus juegos"}
                    </h3>
                    <p>
                      {view === "favorites"
                        ? "Marca la estrella de cualquier juego para tenerlo siempre a mano."
                        : view === "recent"
                          ? "Los juegos que abras desde Orbit se guardarán en esta lista."
                          : "Prueba otro filtro, detecta tus juegos o agrega uno manualmente."}
                    </p>
                    <button className="button" onClick={() => setDialog("add")}>
                      <Plus size={16} />
                      Añadir juego
                    </button>
                  </div>
                )}
                <footer className="library-footer">
                  <span>
                    <Monitor size={14} />
                    Biblioteca local de Windows
                  </span>
                  <span>
                    {visible.filter((g) => statusOf(g) === "installed").length}{" "}
                    juegos listos para jugar <CheckCircle2 size={13} />
                  </span>
                </footer>
              </section>
            </>
          )}
        </div>
      </main>
      <GameDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        game={games.find((g) => g.id === dialog)}
        action={action}
        onAdded={select}
      />
      <SettingsDialog
        accounts={library?.accounts}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={library?.settings}
        action={action}
        appName={library?.appName}
        version={library?.version}
        onSetup={() => {
          setSettingsOpen(false);
          setSetupOpen(true);
        }}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={4500}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={!!error}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError("")}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}
