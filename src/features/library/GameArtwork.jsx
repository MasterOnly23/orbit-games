import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { nameOf } from "./useLibrary";
export default function GameArtwork({ game, hero = false }) {
  const [failed, setFailed] = useState(0);
  const steamId = game.metadata?.steamId || game.steamId;
  const cover = steamId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/library_600x900.jpg`
    : null;
  const header =
    game.metadata?.header ||
    (steamId
      ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`
      : null);
  const candidates = hero ? [game.metadata?.hero, header] : [cover, header];
  if (game.artworkRevision)
    candidates.unshift(`orbit-art://game/${game.id}?v=${game.artworkRevision}`);
  const sources = candidates.filter((s, i, a) => s && a.indexOf(s) === i);
  useEffect(
    () => setFailed(0),
    [
      game.id,
      game.metadata?.steamId,
      game.metadata?.hero,
      game.artworkRevision,
    ],
  );
  const hue =
    Array.from(game.name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return sources[failed] ? (
    <img
      className="game-art"
      src={sources[failed]}
      alt=""
      loading={hero ? "eager" : "lazy"}
      onError={() => setFailed((v) => v + 1)}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="art-fallback" style={{ "--game-hue": hue }}>
      <div className="art-orbit" />
      <Gamepad2 size={hero ? 90 : 44} strokeWidth={1} />
      <span>{nameOf(game)}</span>
    </div>
  );
}
