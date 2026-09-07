import { Star, Check, HelpCircle } from "lucide-react";
import GameArtwork from "./GameArtwork";
import { nameOf, statusOf, statusLabel } from "./useLibrary";
export default function GameCard({ game, selected, onSelect, onFavorite }) {
  const status = statusOf(game);
  return (
    <article className={`game-card ${selected ? "selected" : ""}`}>
      <button
        className="card-select"
        onClick={onSelect}
        aria-label={`Seleccionar ${nameOf(game)}`}
        aria-pressed={selected}
      >
        <div className="card-image">
          <GameArtwork game={game} />
          <div className="card-shade" />
          <span className={`card-status ${status}`} title={statusLabel[status]}>
            {status === "installed" ? (
              <Check size={12} />
            ) : status === "unknown" ? (
              <HelpCircle size={12} />
            ) : null}
            {status === "installed" ? "Listo para jugar" : statusLabel[status]}
          </span>
        </div>
        <div className="card-info">
          <h3 title={nameOf(game)}>{nameOf(game)}</h3>
          <span>
            <i
              className={`provider-dot ${game.provider.replaceAll(" ", "-")}`}
            />
            {game.provider}
          </span>
        </div>
      </button>
      <button
        className={`card-favorite ${game.favorite ? "active" : ""}`}
        onClick={onFavorite}
        aria-label={`${game.favorite ? "Quitar de" : "Agregar a"} favoritos: ${nameOf(game)}`}
      >
        <Star size={15} fill={game.favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
