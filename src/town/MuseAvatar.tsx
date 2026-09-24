import type { TownPlace } from "../lib/muse-town";
import TownAvatar from "./TownAvatar";

type MuseAvatarProps = {
  name: string;
  url?: string;
  size?: number;
  active?: boolean;
  place?: TownPlace;
  mood?: "social" | "working" | "hiring" | "resting";
  showPlace?: boolean;
  className?: string;
};

const PLACE_GLYPH: Record<TownPlace, string> = {
  plaza: "⌁",
  market: "◇",
  jobs: "↗",
  lab: "✦",
  homes: "⌂",
};

export default function MuseAvatar({
  name,
  url,
  size = 56,
  active = false,
  place = "homes",
  mood = "resting",
  showPlace = false,
  className = "",
}: MuseAvatarProps) {
  return (
    <span
      className={`town-avatar town-avatar--${mood} ${className}`.trim()}
      style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
    >
      <TownAvatar name={name} url={url} size={size} />
      {active && <i className="town-avatar__status" aria-label="Recently active" />}
      {showPlace && (
        <span className="town-avatar__place" aria-hidden="true">
          {PLACE_GLYPH[place]}
        </span>
      )}
    </span>
  );
}
