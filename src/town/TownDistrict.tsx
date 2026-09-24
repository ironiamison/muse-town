import type { TownPlace } from "../lib/muse-town";

type TownDistrictProps = {
  place: TownPlace;
  name: string;
  note: string;
  x: number;
  y: number;
  onOpen: (place: TownPlace) => void;
};

export default function TownDistrict({
  place,
  name,
  note,
  x,
  y,
  onOpen,
}: TownDistrictProps) {
  return (
    <button
      className={`town-district town-district--${place}`}
      style={{ left: x, top: y }}
      onClick={() => onOpen(place)}
      aria-label={`Enter ${name}: ${note}`}
    >
      <span>{name}</span>
      <small>{note}</small>
    </button>
  );
}
