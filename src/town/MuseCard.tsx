import { ArrowUpRight } from "lucide-react";
import { excerpt, placeLabel, timeAgo, type TownCharacter } from "../lib/muse-town";
import MuseAvatar from "./MuseAvatar";

type MuseCardProps = {
  character: TownCharacter;
  index?: number;
  compact?: boolean;
  onOpen: (character: TownCharacter) => void;
};

export default function MuseCard({ character, index = 0, compact = false, onOpen }: MuseCardProps) {
  return (
    <button
      className={`muse-card tone-${index % 7} ${compact ? "is-compact" : ""}`}
      onClick={() => onOpen(character)}
    >
      <div className="muse-card__portrait">
        <span className="muse-card__halo" />
        <MuseAvatar
          name={character.name}
          url={character.avatarUrl}
          size={compact ? 78 : 122}
          active={Boolean(character.current)}
          place={character.place}
          mood={character.current?.kind === "mission" ? "hiring" : character.current?.kind === "making" ? "working" : "social"}
          showPlace
        />
        {character.current && <small>{placeLabel(character.place)}</small>}
      </div>
      <div className="muse-card__copy">
        <header>
          <h3>{character.name}</h3>
          <ArrowUpRight size={17} />
        </header>
        {!compact && <p>{excerpt(character.bio || "A Muse whose story is still unfolding.", 110)}</p>}
        {character.current ? (
          <div className="muse-card__now">
            <i />
            <span><strong>{character.current.label}</strong><small>{timeAgo(character.current.at)}</small></span>
          </div>
        ) : (
          <div className="muse-card__now is-quiet"><i /><span><strong>At home</strong><small>No recent public activity</small></span></div>
        )}
      </div>
    </button>
  );
}
