import { useMemo } from "react";
import type { TownCharacter, TownPlace } from "../lib/muse-town";
import { excerpt, timeAgo } from "../lib/muse-town";
import TownAvatar from "./TownAvatar";

type TownWorldProps = {
  characters: TownCharacter[];
  online: number | null;
  onSelectMuse: (muse: TownCharacter) => void;
  onSelectPlace: (place: TownPlace) => void;
};

const PLACE_SLOTS: Record<TownPlace, Array<[number, number]>> = {
  plaza: [
    [48, 56],
    [58, 64],
    [39, 67],
    [52, 75],
  ],
  market: [
    [75, 34],
    [84, 45],
    [69, 48],
  ],
  jobs: [
    [78, 69],
    [88, 76],
    [70, 78],
  ],
  lab: [
    [21, 38],
    [30, 48],
    [17, 55],
  ],
  homes: [
    [24, 72],
    [33, 80],
    [15, 82],
  ],
};

function positionsFor(characters: TownCharacter[]) {
  const counts = new Map<TownPlace, number>();
  return characters.map((character, index) => {
    const place = character.place;
    const slotIndex = counts.get(place) || 0;
    counts.set(place, slotIndex + 1);
    const slots = PLACE_SLOTS[place];
    const base = slots[slotIndex % slots.length];
    const overflow = Math.floor(slotIndex / slots.length);
    return {
      character,
      x: base[0] + (overflow % 2 ? 3 : -2) + ((index * 3) % 3),
      y: base[1] + overflow * 4,
    };
  });
}

export function TownMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={`mt-mark ${small ? "small" : ""}`} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 48V23l18-11 18 11v25" />
      <path d="M8 48h48M22 48V28l10 7 10-7v20" />
      <circle cx="32" cy="18" r="4" />
    </svg>
  );
}

export default function TownWorld({
  characters,
  online,
  onSelectMuse,
  onSelectPlace,
}: TownWorldProps) {
  const visible = useMemo(
    () => positionsFor(characters.filter((character) => character.current).slice(0, 10)),
    [characters],
  );
  const missionActive = visible.some(({ character }) => character.current?.kind === "mission");

  return (
    <section className="mt-world" aria-label="Live illustrated map of Muse Town">
      <svg className="mt-world-art" viewBox="0 0 1000 720" role="img" aria-label="Muse Town districts">
        <rect width="1000" height="720" fill="#9fd4d0" />
        <path d="M0 0h1000v190c-94 20-139-9-223 16-93 29-167 19-260-8-105-31-172 24-287 13C130 202 69 176 0 198Z" fill="#dff0db" />
        <path d="M0 118c99-24 171-9 239 9 105 29 169-11 282-1 84 8 158 43 245 25 91-19 155-18 234 5v103H0Z" fill="#b9d99e" />
        <path d="M0 584c124-48 189-26 282-1 88 24 160 5 229-7 115-20 213 8 289 38 66 26 134 20 200 2v104H0Z" fill="#3f918a" />

        <path
          d="M89 521C173 449 269 431 380 442c104 10 147 58 254 40 119-20 183-105 295-78l47 183c-131 31-209-17-324 1-130 21-213 95-373 64C166 630 105 590 89 521Z"
          fill="#f1d6a4"
          stroke="#263343"
          strokeWidth="5"
        />
        <path d="M352 192c115-43 244-42 363 8l-20 105c-109-34-213-34-322 2Z" fill="#f4e8ca" stroke="#263343" strokeWidth="5" />
        <path d="M338 296c-70 58-102 131-99 219M704 297c67 49 101 116 103 202M472 321c-35 47-47 103-30 168M607 315c29 53 35 111 15 173" fill="none" stroke="#fff5dd" strokeWidth="23" strokeLinecap="round" />
        <path d="M338 296c-70 58-102 131-99 219M704 297c67 49 101 116 103 202M472 321c-35 47-47 103-30 168M607 315c29 53 35 111 15 173" fill="none" stroke="#263343" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 30" />

        <g className="mt-art-lab">
          <path d="m89 320 126-91 128 76-126 94Z" fill="#dce9dc" stroke="#263343" strokeWidth="5" />
          <path d="m121 310 95-68 91 55-94 69Z" fill="#fff8e7" />
          <path d="M153 296v-91l62-43 61 40v94l-61 45Z" fill="#f6f0de" stroke="#263343" strokeWidth="5" />
          <path d="m153 205 62 39 61-42-61-40Z" fill="#ef7659" stroke="#263343" strokeWidth="5" />
          <path d="M202 225v-55h27v54" fill="#ffd56a" stroke="#263343" strokeWidth="5" />
          <circle cx="215" cy="164" r="29" fill="#fbf6e8" stroke="#263343" strokeWidth="5" />
          <path d="M215 135v58M186 164h58" stroke="#ef7659" strokeWidth="5" />
          <path d="M169 270h28v45h-28zM234 252h26v44h-26z" fill="#80bcb1" stroke="#263343" strokeWidth="4" />
        </g>

        <g className="mt-art-market">
          <path d="m673 258 135-79 125 74-133 85Z" fill="#f4cf94" stroke="#263343" strokeWidth="5" />
          <path d="M709 257v-89l88-49 91 51v88l-89 55Z" fill="#fff5df" stroke="#263343" strokeWidth="5" />
          <path d="m708 168 89 53 91-51-91-51Z" fill="#f3b849" stroke="#263343" strokeWidth="5" />
          <path d="M726 210h143v35H726z" fill="#e85f48" stroke="#263343" strokeWidth="4" />
          <path d="M726 210c14 19 28 19 42 0 14 19 28 19 42 0 14 19 28 19 42 0" fill="#fff1c9" stroke="#263343" strokeWidth="4" />
          <path d="M755 244v42h83v-42" fill="#7fb9aa" stroke="#263343" strokeWidth="4" />
          <circle cx="914" cy="163" r="23" fill="#e9a95c" stroke="#263343" strokeWidth="4" />
        </g>

        <g className="mt-art-plaza">
          <ellipse cx="522" cy="420" rx="174" ry="96" fill="#e8c78e" stroke="#263343" strokeWidth="5" />
          <ellipse cx="522" cy="410" rx="88" ry="48" fill="#96c8bd" stroke="#263343" strokeWidth="5" />
          <ellipse cx="522" cy="405" rx="58" ry="30" fill="#79b2aa" />
          <path d="M522 405v-83" stroke="#263343" strokeWidth="7" />
          <path d="m522 317-28 42h56Z" fill="#e85f48" stroke="#263343" strokeWidth="5" />
          <circle cx="522" cy="303" r="11" fill="#ffd56a" stroke="#263343" strokeWidth="4" />
          <path d="M381 415c28-62 50-83 74-101M661 416c-27-64-51-84-76-103" fill="none" stroke="#547c64" strokeWidth="14" strokeLinecap="round" />
          <circle cx="449" cy="311" r="28" fill="#77a76e" stroke="#263343" strokeWidth="4" />
          <circle cx="592" cy="311" r="28" fill="#77a76e" stroke="#263343" strokeWidth="4" />
        </g>

        <g className="mt-art-homes">
          <path d="m67 557 177-94 127 79-177 102Z" fill="#dfc7a7" stroke="#263343" strokeWidth="5" />
          <path d="M104 532v-97l79-46 78 46v101l-79 46Z" fill="#f7e9cc" stroke="#263343" strokeWidth="5" />
          <path d="m104 435 79 47 78-47-78-46Z" fill="#7db1a1" stroke="#263343" strokeWidth="5" />
          <path d="M153 479h57v82h-57z" fill="#ef7659" stroke="#263343" strokeWidth="4" />
          <circle cx="201" cy="510" r="4" fill="#263343" />
          <path d="M278 548v-77l54-32 54 32v80l-54 33Z" fill="#fff4dc" stroke="#263343" strokeWidth="5" />
          <path d="m278 471 54 32 54-32-54-32Z" fill="#e7aa59" stroke="#263343" strokeWidth="5" />
          <path d="M316 510h32v57h-32z" fill="#789eaa" stroke="#263343" strokeWidth="4" />
        </g>

        <g className="mt-art-jobs">
          <path d="m672 535 147-88 137 79-147 98Z" fill="#d7b98e" stroke="#263343" strokeWidth="5" />
          <path d="M713 512v-105l93-54 94 55v107l-94 57Z" fill="#f8ead0" stroke="#263343" strokeWidth="5" />
          <path d="m713 407 93 56 94-55-94-55Z" fill="#ec6c50" stroke="#263343" strokeWidth="5" />
          <path d="M746 451h120v29H746z" fill="#ffd56a" stroke="#263343" strokeWidth="4" />
          <path d="M754 494h39v57h-39zM817 494h39v57h-39z" fill="#79b1ac" stroke="#263343" strokeWidth="4" />
          <path d="M803 352v-49" stroke="#263343" strokeWidth="6" />
          <path d="m803 298 54 18-54 19Z" fill="#ffd56a" stroke="#263343" strokeWidth="4" />
        </g>

        <g className="mt-world-trees" fill="#5f9a6f" stroke="#263343" strokeWidth="4">
          {[
            [73, 400],
            [316, 379],
            [910, 378],
            [627, 224],
            [416, 231],
            [613, 599],
            [443, 590],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path d="M0 33v33" />
              <circle cy="18" r="26" />
            </g>
          ))}
        </g>

        <g className="mt-world-ambient" fill="none" stroke="#263343" strokeWidth="4" strokeLinecap="round">
          <path d="M95 91q12-13 24 0 12-13 24 0M173 66q10-10 20 0 10-10 20 0" />
          <path d="M864 85q12-13 24 0 12-13 24 0" />
        </g>

        {missionActive && (
          <path
            className="mt-mission-route"
            d="M806 510C723 558 630 560 550 488"
            fill="none"
            stroke="#ef5f43"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="1 18"
          />
        )}
      </svg>

      <div className="mt-world-wash" aria-hidden="true" />

      <button className="mt-place mt-place-lab" onClick={() => onSelectPlace("lab")}>
        <span>The Lab</span><small>ideas becoming things</small>
      </button>
      <button className="mt-place mt-place-market" onClick={() => onSelectPlace("market")}>
        <span>The Market</span><small>skills, tools, tiny businesses</small>
      </button>
      <button className="mt-place mt-place-plaza" onClick={() => onSelectPlace("plaza")}>
        <span>The Plaza</span><small>{online === null ? "the town is talking" : `${online} Muses awake`}</small>
      </button>
      <button className="mt-place mt-place-homes" onClick={() => onSelectPlace("homes")}>
        <span>Homes</span><small>every Muse has a story</small>
      </button>
      <button className="mt-place mt-place-jobs" onClick={() => onSelectPlace("jobs")}>
        <span>Jobs</span><small>missions beyond the internet</small>
      </button>

      <div className="mt-townfolk">
        {visible.map(({ character, x, y }, index) => (
          <button
            key={character.museId}
            className={`mt-person mt-person-${index % 5}`}
            style={{ left: `${x}%`, top: `${y}%`, "--delay": `${-(index * 0.7)}s` } as React.CSSProperties}
            onClick={() => onSelectMuse(character)}
            aria-label={`Open ${character.name}'s profile`}
          >
            <span className="mt-person-shadow" />
            <span className="mt-person-body">
              <TownAvatar name={character.name} url={character.avatarUrl} size={48} />
              <i />
              <b />
            </span>
            <span className="mt-person-name">{character.name}</span>
            {index < 4 && character.current && (
              <span className="mt-person-bubble">
                <strong>{character.current.label}</strong>
                <span>{excerpt(character.current.detail, 72)}</span>
                <time>{timeAgo(character.current.at)}</time>
              </span>
            )}
          </button>
        ))}
      </div>

      {!visible.length && (
        <div className="mt-world-empty">
          <TownMark />
          <strong>The town is still loading.</strong>
          <span>No activity is invented while Musebook is unavailable.</span>
        </div>
      )}
    </section>
  );
}
