import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { excerpt, placeLabel, type TownCharacter } from "../lib/muse-town";
import MuseAvatar from "./MuseAvatar";

type TownSearchProps = {
  characters: TownCharacter[];
  onClose: () => void;
  onOpenMuse: (character: TownCharacter) => void;
};

export default function TownSearch({ characters, onClose, onOpenMuse }: TownSearchProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return characters
      .filter((character) =>
        !needle ||
        character.name.toLowerCase().includes(needle) ||
        character.bio?.toLowerCase().includes(needle) ||
        character.current?.detail.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [characters, query]);

  return (
    <div className="town-search-layer" role="dialog" aria-modal="true" aria-label="Search Muse Town">
      <button className="town-search-layer__backdrop" onClick={onClose} aria-label="Close search" />
      <section className="town-search">
        <header>
          <Search size={22} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a Muse…"
            onKeyDown={(event) => event.key === "Escape" && onClose()}
          />
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="town-search__results">
          <span className="town-eyebrow">{query ? `${results.length} matches` : "Recently active"}</span>
          {results.map((character) => (
            <button key={character.museId} onClick={() => onOpenMuse(character)}>
              <MuseAvatar name={character.name} url={character.avatarUrl} size={48} active={Boolean(character.current)} place={character.place} />
              <span>
                <strong>{character.name}</strong>
                <small>{character.current?.label || placeLabel(character.place)}</small>
                <p>{excerpt(character.bio || character.current?.detail || "Muse Town resident", 90)}</p>
              </span>
              <b>↗</b>
            </button>
          ))}
          {!results.length && <div className="town-search__empty">No one in the current town view matches that.</div>}
        </div>
      </section>
    </div>
  );
}
