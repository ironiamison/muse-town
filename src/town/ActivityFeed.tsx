import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { excerpt, placeLabel, timeAgo, type TownCharacter } from "../lib/muse-town";
import MuseAvatar from "./MuseAvatar";

type ActivityFeedProps = {
  characters: TownCharacter[];
  onOpenMuse: (character: TownCharacter) => void;
};

const EVENT_GLYPH = {
  conversation: "⌁",
  making: "✦",
  market: "◇",
  mission: "↗",
  arrival: "⌂",
} as const;

export default function ActivityFeed({ characters, onOpenMuse }: ActivityFeedProps) {
  const [collapsed, setCollapsed] = useState(false);
  const events = characters.filter((character) => character.current).slice(0, 14);

  return (
    <aside className={`town-activity ${collapsed ? "is-collapsed" : ""}`} aria-label="Happening now">
      <button
        className="town-activity__collapse"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Open activity" : "Collapse activity"}
      >
        {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {collapsed ? (
        <div className="town-activity__collapsed-mark">
          <Sparkles size={17} />
          <span>{events.length}</span>
        </div>
      ) : (
        <>
          <header className="town-activity__header">
            <div>
              <span className="town-eyebrow">Live from town</span>
              <h2>Happening now</h2>
            </div>
            <i />
          </header>

          <div className="town-activity__list">
            {events.map((character, index) => {
              const activity = character.current!;
              return (
                <button
                  key={`${character.museId}-${activity.at}`}
                  className={`town-activity__event is-${activity.kind}`}
                  onClick={() => onOpenMuse(character)}
                  style={{ "--event-delay": `${index * 32}ms` } as React.CSSProperties}
                >
                  <MuseAvatar
                    name={character.name}
                    url={character.avatarUrl}
                    size={42}
                    active
                    place={character.place}
                    mood={activity.kind === "mission" ? "hiring" : activity.kind === "making" ? "working" : "social"}
                  />
                  <span className="town-activity__copy">
                    <strong>{character.name}</strong>
                    <small>{activity.label}</small>
                    <p>{excerpt(activity.detail, 86)}</p>
                    <time>{placeLabel(character.place)} · {timeAgo(activity.at)}</time>
                  </span>
                  <i className="town-activity__kind" aria-hidden="true">{EVENT_GLYPH[activity.kind]}</i>
                </button>
              );
            })}
            {!events.length && (
              <div className="town-activity__empty">
                <span>☼</span>
                <strong>The feed is quiet.</strong>
                <p>Nothing is fabricated while live activity is unavailable.</p>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
