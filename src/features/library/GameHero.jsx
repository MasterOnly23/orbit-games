import {
  Play,
  Star,
  FolderOpen,
  Settings2,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
  HardDrive,
} from "lucide-react";
import GameArtwork from "./GameArtwork";
import { nameOf, statusOf, statusLabel } from "./useLibrary";
export default function GameHero({
  game,
  onPlay,
  onFavorite,
  onEdit,
  onReveal,
  onSource,
  launching,
  online,
}) {
  const status = statusOf(game),
    meta = game.metadata;
  const canOpenLauncher = [
    "Steam",
    "EA app",
    "Xbox",
    "Epic Games",
    "Ubisoft",
    "Battle.net",
    "Humble Bundle",
    "GOG",
  ].includes(game.provider);
  return (
    <section
      className="game-hero"
      aria-label={`Juego seleccionado: ${nameOf(game)}`}
    >
      <div className="hero-art">
        <GameArtwork game={game} hero online={online} />
      </div>
      <div className="hero-gradient" />
      <div className="hero-content">
        <div className="hero-eyebrow">
          <span
            className={`provider-tag ${game.provider.replaceAll(" ", "-")}`}
          >
            {game.provider}
          </span>
          <span>TU PRÓXIMA PARTIDA</span>
        </div>
        <h1>{nameOf(game)}</h1>
        <div className="hero-genres">
          {meta?.genres?.slice(0, 3).map((g) => (
            <span key={g}>{g}</span>
          ))}
          {meta?.releaseDate && <span>{meta.releaseDate}</span>}
        </div>
        <p className="hero-description">
          {meta?.description ||
            "Tu próxima aventura empieza aquí. Selecciona una ficha para añadir imágenes y detalles de este juego."}
        </p>
        <div className="hero-actions">
          <button
            className="button primary play-button"
            onClick={
              status === "uninstalled" && !canOpenLauncher ? onEdit : onPlay
            }
            disabled={launching}
          >
            {status === "uninstalled" ? (
              <ArrowUpRight size={19} />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
            {launching
              ? "Abriendo…"
              : status === "uninstalled"
                ? canOpenLauncher
                  ? ["Humble Bundle", "GOG"].includes(game.provider)
                    ? "Ver biblioteca web"
                    : "Abrir lanzador"
                  : "Actualizar ruta"
                : status === "unknown"
                  ? "Abrir juego"
                  : "Jugar ahora"}
          </button>
          <button
            className={`button icon-button ${game.favorite ? "favorite-active" : ""}`}
            onClick={onFavorite}
            title="Favorito"
            aria-label="Marcar favorito"
          >
            <Star size={20} fill={game.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="button icon-button"
            onClick={onEdit}
            title="Editar juego y ficha"
            aria-label="Editar juego"
          >
            <Settings2 size={20} />
          </button>
          <button className="text-button details-link" onClick={onReveal}>
            <FolderOpen size={16} />
            Archivos
          </button>
        </div>
        <div className={`hero-status ${status}`} title={game.statusReason}>
          {status === "installed" ? (
            <CheckCircle2 size={13} />
          ) : status === "unknown" ? (
            <HelpCircle size={13} />
          ) : (
            <HardDrive size={13} />
          )}
          <span>
            {statusLabel[status]}
            {game.statusOverride && game.statusOverride !== "auto"
              ? " · Estado manual"
              : ""}
          </span>
          {game.sizeBytes > 0 && (
            <span className="install-size">
              {(game.sizeBytes / 1024 ** 3).toFixed(1)} GB
            </span>
          )}
        </div>
      </div>
      {game.accountAccessNote && (
        <p className="account-access-note">{game.accountAccessNote}</p>
      )}
      {meta && (
        <button className="source-credit" onClick={onSource}>
          {game.artworkRevision ? "Ficha: Steam" : "Ficha e imágenes: Steam"}{" "}
          <ArrowUpRight size={11} />
        </button>
      )}
    </section>
  );
}
