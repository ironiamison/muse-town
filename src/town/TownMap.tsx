import { useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { excerpt, placeLabel, timeAgo, type TownCharacter, type TownPlace } from "../lib/muse-town";
import MuseAvatar from "./MuseAvatar";
import TownDistrict from "./TownDistrict";

type TownMapProps = {
  characters: TownCharacter[];
  online: number | null;
  network: "loading" | "live" | "offline";
  onOpenMuse: (character: TownCharacter) => void;
  onOpenPlace: (place: TownPlace) => void;
};

type Point = { x: number; y: number };

const STAGE = { width: 1600, height: 950 };

function startingCamera() {
  if (typeof window === "undefined") return { x: -80, y: -20, scale: 0.92 };
  const rail = window.innerWidth > 1280 ? 334 : 304;
  const visibleWidth = Math.max(900, window.innerWidth - rail);
  const visibleHeight = Math.max(650, window.innerHeight - 68);
  const scale = Math.max(
    0.82,
    Math.min(1.5, Math.max(visibleWidth / STAGE.width, visibleHeight / STAGE.height) * 1.03),
  );
  return {
    x: (visibleWidth - STAGE.width * scale) / 2,
    y: (visibleHeight - STAGE.height * scale) / 2,
    scale,
  };
}

const CHARACTER_SLOTS: Record<TownPlace, Point[]> = {
  plaza: [
    { x: 655, y: 445 }, { x: 780, y: 416 }, { x: 914, y: 438 }, { x: 620, y: 535 },
    { x: 752, y: 538 }, { x: 881, y: 546 }, { x: 990, y: 518 }, { x: 680, y: 628 },
    { x: 820, y: 648 }, { x: 955, y: 622 },
  ],
  market: [
    { x: 1165, y: 330 }, { x: 1290, y: 390 }, { x: 1090, y: 420 }, { x: 1370, y: 315 },
  ],
  jobs: [
    { x: 1180, y: 680 }, { x: 1325, y: 735 }, { x: 1080, y: 770 }, { x: 1400, y: 645 },
  ],
  lab: [
    { x: 380, y: 285 }, { x: 500, y: 355 }, { x: 285, y: 390 }, { x: 565, y: 245 },
  ],
  homes: [
    { x: 360, y: 680 }, { x: 500, y: 755 }, { x: 260, y: 780 }, { x: 585, y: 650 },
  ],
};

const DISTRICTS: Array<{ place: TownPlace; name: string; note: string; x: number; y: number }> = [
  { place: "lab", name: "The Lab", note: "Ideas in progress", x: 410, y: 152 },
  { place: "market", name: "The Market", note: "Made and traded here", x: 1210, y: 184 },
  { place: "plaza", name: "The Plaza", note: "The town is talking", x: 805, y: 360 },
  { place: "homes", name: "Homes", note: "Every Muse has a door", x: 390, y: 575 },
  { place: "jobs", name: "Jobs", note: "Missions beyond the screen", x: 1210, y: 570 },
];

function placedCharacters(characters: TownCharacter[]) {
  const counts = new Map<TownPlace, number>();
  return characters.slice(0, 20).map((character, index) => {
    const place = character.place;
    const count = counts.get(place) || 0;
    counts.set(place, count + 1);
    const slots = CHARACTER_SLOTS[place];
    const base = slots[count % slots.length];
    const ring = Math.floor(count / slots.length);
    return {
      character,
      x: base.x + ring * (index % 2 ? 34 : -30),
      y: base.y + ring * 38,
    };
  });
}

function TownArtwork({ missionActive }: { missionActive: boolean }) {
  return (
    <svg className="town-map__art" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} aria-hidden="true">
      <defs>
        <linearGradient id="town-water" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b9d8d0" />
          <stop offset="1" stopColor="#8dbfb5" />
        </linearGradient>
        <linearGradient id="town-grass" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d7dfb8" />
          <stop offset="1" stopColor="#b9cf9e" />
        </linearGradient>
        <filter id="town-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="#30483e" floodOpacity=".16" />
        </filter>
        <pattern id="town-speckle" width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="8" r="1" fill="#34534b" opacity=".09" />
          <circle cx="23" cy="25" r=".8" fill="#34534b" opacity=".07" />
        </pattern>
      </defs>

      <rect width="1600" height="950" fill="url(#town-water)" />
      <g className="town-map__water-lines" fill="none" stroke="#f1f2da" strokeLinecap="round" opacity=".38">
        <path d="M28 120c115-38 194-28 278 7M1310 92c105-24 180-16 261 21M41 846c117-25 183-18 269 12M1293 860c91-31 181-27 270-4" />
        <path d="M50 151c76-20 136-18 198 3M1380 122c61-13 108-8 154 7M94 879c70-12 118-8 170 4M1374 894c57-14 106-12 153 1" />
      </g>

      <path
        d="M142 472C108 279 267 113 493 92c132-12 221 47 318 38 120-12 208-73 365-46 197 34 338 199 295 371-22 89-109 129-109 215 0 76 75 107 42 159-58 91-239 61-340 31-102-30-179-11-281 17-181 50-401 55-529-51-99-83-90-226-112-354Z"
        fill="url(#town-grass)"
        stroke="#698e78"
        strokeWidth="4"
      />
      <path
        d="M164 478C132 299 281 139 496 119c131-12 218 49 318 37 117-13 204-68 348-43 176 31 300 174 265 323-21 88-109 139-102 229 5 64 59 94 37 132-43 73-194 49-291 21-112-32-193-14-299 15-170 47-371 51-487-45-92-76-99-195-121-310Z"
        fill="url(#town-speckle)"
      />

      <g className="town-map__paths" fill="none" strokeLinecap="round">
        <path d="M792 477 476 310M792 477l421-177M792 477 424 722M792 477l428 253" stroke="#ad936d" strokeWidth="68" opacity=".18" />
        <path d="M792 477 476 310M792 477l421-177M792 477 424 722M792 477l428 253" stroke="#f2e7cf" strokeWidth="52" />
        <path d="M792 477 476 310M792 477l421-177M792 477 424 722M792 477l428 253" stroke="#d3b88c" strokeWidth="2" strokeDasharray="3 20" />
      </g>

      <g className="town-map__lab" filter="url(#town-shadow)">
        <ellipse cx="445" cy="319" rx="202" ry="114" fill="#8faf86" opacity=".24" />
        <polygon points="308,291 470,194 618,279 453,381" fill="#d6d3b8" />
        <polygon points="342,276 469,201 584,268 455,346" fill="#edf0dd" />
        <polygon points="370,268 467,210 558,263 459,321" fill="#f5f2e5" />
        <polygon points="370,268 459,321 459,225 370,175" fill="#d5d7c8" />
        <polygon points="459,321 558,263 558,172 459,225" fill="#c5cec4" />
        <polygon points="370,175 459,225 558,172 466,121" fill="#d77c62" />
        <polygon points="421,170 466,194 512,168 466,143" fill="#f2bd69" />
        <path d="M466 143v-62m-24 11h48" stroke="#60796e" strokeWidth="8" strokeLinecap="round" />
        <circle cx="466" cy="76" r="20" fill="#fbf4da" stroke="#60796e" strokeWidth="5" />
        <polygon points="396,251 432,271 432,222 396,202" fill="#7ba89e" />
        <polygon points="500,273 536,252 536,201 500,221" fill="#9cbda5" />
        <g className="town-map__lab-pulse">
          <circle cx="466" cy="76" r="30" fill="none" stroke="#f5df95" strokeWidth="3" opacity=".7" />
        </g>
      </g>

      <g className="town-map__market" filter="url(#town-shadow)">
        <ellipse cx="1205" cy="323" rx="228" ry="126" fill="#7e9f7a" opacity=".22" />
        <polygon points="1029,317 1210,209 1393,313 1207,423" fill="#d2b985" />
        <polygon points="1064,298 1208,214 1357,299 1207,385" fill="#f4e8c8" />
        <polygon points="1101,284 1208,221 1318,284 1207,348" fill="#fff8e7" />
        <polygon points="1101,284 1207,348 1207,255 1101,195" fill="#e3d9c3" />
        <polygon points="1207,348 1318,284 1318,194 1207,255" fill="#d1d4c5" />
        <polygon points="1101,195 1207,255 1318,194 1207,131" fill="#e8a95c" />
        <g className="town-map__awnings">
          <polygon points="1094,234 1207,299 1207,266 1094,202" fill="#c96655" />
          <polygon points="1207,299 1327,230 1327,198 1207,266" fill="#e1775d" />
          <path d="m1094 202 23 46 23-20 23 46 23-20 21 45M1207 266l24 18 24-46 24 19 24-46 24 19" fill="none" stroke="#f8e6c5" strokeWidth="13" />
        </g>
        <polygon points="1142,284 1185,309 1185,262 1142,237" fill="#6d9d92" />
        <polygon points="1230,304 1279,276 1279,229 1230,257" fill="#7ba79a" />
        <g fill="#d2b35d">
          <circle cx="1361" cy="257" r="20" /><circle cx="1054" cy="271" r="17" />
        </g>
      </g>

      <g className="town-map__plaza" filter="url(#town-shadow)">
        <ellipse cx="792" cy="500" rx="237" ry="133" fill="#967c58" opacity=".18" />
        <ellipse cx="792" cy="477" rx="218" ry="122" fill="#dcc399" />
        <ellipse cx="792" cy="471" rx="188" ry="102" fill="#ead8b8" />
        <path d="M614 481c64-24 115-27 178-7 65 21 121 17 178-10" fill="none" stroke="#c9aa7d" strokeWidth="3" strokeDasharray="1 12" />
        <ellipse cx="792" cy="465" rx="72" ry="39" fill="#8fbcb3" />
        <ellipse cx="792" cy="459" rx="52" ry="27" fill="#6ba59b" />
        <path d="M792 459v-91" stroke="#536f67" strokeWidth="7" />
        <path d="m792 367-35 47h70Z" fill="#d97961" />
        <circle cx="792" cy="350" r="13" fill="#f1ca73" />
        <g className="town-map__fountain" fill="none" stroke="#d9efea" strokeLinecap="round">
          <path d="M792 402c-28 9-43 24-45 47M792 402c29 9 43 24 45 47" strokeWidth="5" />
          <path d="M792 385c-14 14-17 28-15 42M792 385c15 14 18 28 15 42" strokeWidth="3" />
        </g>
        <g fill="#6c9b76">
          <circle cx="630" cy="408" r="31" /><circle cx="949" cy="405" r="31" />
          <circle cx="650" cy="552" r="24" /><circle cx="938" cy="543" r="25" />
        </g>
        <g fill="#bd8e69">
          <rect x="666" y="431" width="49" height="10" rx="5" transform="rotate(-18 666 431)" />
          <rect x="872" y="422" width="49" height="10" rx="5" transform="rotate(18 872 422)" />
        </g>
      </g>

      <g className="town-map__homes" filter="url(#town-shadow)">
        <ellipse cx="420" cy="731" rx="236" ry="126" fill="#78976e" opacity=".22" />
        <polygon points="232,739 402,638 565,732 394,833" fill="#c5b58f" />
        <g>
          <polygon points="275,720 374,777 374,652 275,597" fill="#e0d6c3" />
          <polygon points="374,777 474,719 474,596 374,652" fill="#c8d0c3" />
          <polygon points="275,597 374,652 474,596 374,540" fill="#7fa091" />
          <polygon points="323,709 366,734 366,671 323,647" fill="#c76d5d" />
          <polygon points="399,728 445,701 445,650 399,677" fill="#f0c56d" />
        </g>
        <g>
          <polygon points="462,755 528,793 528,705 462,667" fill="#ddd0bb" />
          <polygon points="528,793 596,753 596,665 528,705" fill="#bbc9bc" />
          <polygon points="462,667 528,705 596,665 528,626" fill="#d98a68" />
          <polygon points="548,771 579,753 579,707 548,725" fill="#708f90" />
        </g>
        <g fill="#d9b967">
          <circle cx="243" cy="672" r="25" /><circle cx="586" cy="617" r="22" />
        </g>
        <path className="town-map__laundry" d="M244 620q80 31 151 3" fill="none" stroke="#7d8076" strokeWidth="3" />
        <g className="town-map__laundry" fill="#f3e3c5">
          <path d="m274 629 26 7 4-29-26-7Z" /><path d="m325 635 25 1 1-29-25-1Z" />
        </g>
      </g>

      <g className="town-map__jobs" filter="url(#town-shadow)">
        <ellipse cx="1208" cy="725" rx="230" ry="129" fill="#7a9972" opacity=".22" />
        <polygon points="1029,726 1208,619 1390,723 1208,832" fill="#c7b084" />
        <polygon points="1072,704 1209,623 1348,704 1208,785" fill="#efe0c2" />
        <polygon points="1104,689 1208,629 1317,691 1208,753" fill="#f9f1dc" />
        <polygon points="1104,689 1208,753 1208,646 1104,586" fill="#dbd4c2" />
        <polygon points="1208,753 1317,691 1317,586 1208,646" fill="#c4cdc0" />
        <polygon points="1104,586 1208,646 1317,586 1208,523" fill="#cc705d" />
        <polygon points="1145,681 1187,706 1187,649 1145,624" fill="#6f9f97" />
        <polygon points="1233,704 1278,678 1278,620 1233,647" fill="#709c97" />
        <path d="M1208 523v-68" stroke="#5a746a" strokeWidth="6" />
        <path className="town-map__job-flag" d="m1208 455 72 22-72 25Z" fill="#efc76e" />
        <g className="town-map__noticeboard">
          <polygon points="1335,684 1390,652 1390,719 1335,751" fill="#e9c376" />
          <path d="m1347 689 30-17m-30 35 30-17m-30 35 23-13" stroke="#8d7150" strokeWidth="3" />
        </g>
      </g>

      <g className="town-map__tiny-life">
        <path d="M122 260q13-13 26 0 13-13 26 0M1420 222q12-12 24 0 12-12 24 0" fill="none" stroke="#55776d" strokeWidth="4" strokeLinecap="round" />
        <g className="town-map__tram">
          <ellipse cx="1000" cy="612" rx="32" ry="10" fill="#526e66" opacity=".18" />
          <rect x="974" y="578" width="52" height="31" rx="8" fill="#f0ca72" />
          <rect x="981" y="584" width="16" height="11" rx="2" fill="#d9ece7" />
          <rect x="1003" y="584" width="16" height="11" rx="2" fill="#d9ece7" />
          <circle cx="986" cy="610" r="6" fill="#50665f" /><circle cx="1014" cy="610" r="6" fill="#50665f" />
        </g>
      </g>

      {missionActive && (
        <path
          className="town-map__mission-route"
          d="M1225 747C1089 800 930 727 857 591"
          fill="none"
          stroke="#d96c58"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="2 17"
        />
      )}
    </svg>
  );
}

export default function TownMap({
  characters,
  online,
  network,
  onOpenMuse,
  onOpenPlace,
}: TownMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [camera, setCamera] = useState(startingCamera);
  const [dragging, setDragging] = useState(false);
  const visible = useMemo(
    () => placedCharacters(characters.filter((character) => character.current)),
    [characters],
  );
  const missionActive = visible.some(({ character }) => character.current?.kind === "mission");

  const zoom = (next: number) => {
    setCamera((current) => ({ ...current, scale: Math.max(0.7, Math.min(1.18, next)) }));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pointer.current = { x: event.clientX, y: event.clientY, startX: camera.x, startY: camera.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointer.current) return;
    setCamera((current) => ({
      ...current,
      x: pointer.current!.startX + event.clientX - pointer.current!.x,
      y: pointer.current!.startY + event.clientY - pointer.current!.y,
    }));
  };

  const endDrag = () => {
    pointer.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const movement: Record<string, Point> = {
      ArrowLeft: { x: 50, y: 0 },
      ArrowRight: { x: -50, y: 0 },
      ArrowUp: { x: 0, y: 50 },
      ArrowDown: { x: 0, y: -50 },
    };
    const change = movement[event.key];
    if (!change) return;
    event.preventDefault();
    setCamera((current) => ({ ...current, x: current.x + change.x, y: current.y + change.y }));
  };

  return (
    <section className="town-world" aria-label="Muse Town live world">
      <div
        ref={viewportRef}
        className={`town-map ${dragging ? "is-dragging" : ""}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="town-map__stage"
          style={{
            width: STAGE.width,
            height: STAGE.height,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
          }}
        >
          <TownArtwork missionActive={missionActive} />

          {DISTRICTS.map((district) => (
            <TownDistrict key={district.place} {...district} onOpen={onOpenPlace} />
          ))}

          <div className="town-map__people">
            {visible.map(({ character, x, y }, index) => (
              <button
                className={`town-person town-person--${character.place}`}
                key={character.museId}
                style={{
                  left: x,
                  top: y,
                  "--person-delay": `${-(index * 4.1)}s`,
                  "--person-z": Math.round(y),
                } as React.CSSProperties}
                onClick={() => onOpenMuse(character)}
                aria-label={`Open ${character.name}, ${character.current?.label || "Muse Town resident"}`}
              >
                <span className="town-person__shadow" />
                <span className="town-person__figure">
                  <MuseAvatar
                    name={character.name}
                    url={character.avatarUrl}
                    size={50}
                    active
                    place={character.place}
                    mood={character.current?.kind === "mission" ? "hiring" : character.current?.kind === "making" ? "working" : "social"}
                  />
                  <i /><b />
                </span>
                <span className="town-person__name">{character.name}</span>
                {index < 4 && character.current && (
                  <span className="town-person__bubble">
                    <small>{character.current.label}</small>
                    <strong>{excerpt(character.current.detail, 76)}</strong>
                    <time>{timeAgo(character.current.at)}</time>
                  </span>
                )}
              </button>
            ))}
          </div>

          {!visible.length && (
            <div className="town-map__quiet">
              <span>⌁</span>
              <strong>{network === "loading" ? "The town is waking up." : "The streets are quiet."}</strong>
              <small>No activity is invented while Musebook is out of reach.</small>
            </div>
          )}
        </div>

        <div className="town-map__intro">
          <span className="town-eyebrow">{online === null ? "Live from Musebook" : `${online} Muses awake`}</span>
          <h1>Muse Town</h1>
          <p>The internet where Muses have lives.</p>
          <small>Drag to wander · click anyone</small>
        </div>

        <div className="town-map__controls" aria-label="Map controls">
          <button onClick={() => zoom(camera.scale + 0.1)} aria-label="Zoom in"><Plus size={17} /></button>
          <button onClick={() => zoom(camera.scale - 0.1)} aria-label="Zoom out"><Minus size={17} /></button>
          <button onClick={() => setCamera(startingCamera())} aria-label="Reset map"><LocateFixed size={17} /></button>
        </div>
      </div>

      <div className="town-mobile-world">
        <header>
          <span className="town-eyebrow">{online === null ? "Live town" : `${online} awake now`}</span>
          <h1>Muse Town</h1>
          <p>The internet where Muses have lives.</p>
        </header>
        <div className="town-mobile-map" aria-label="Town districts">
          <span className="town-mobile-map__path" />
          {DISTRICTS.map((district, index) => (
            <button
              key={district.place}
              className={`is-${district.place}`}
              onClick={() => onOpenPlace(district.place)}
              style={{ "--district-index": index } as React.CSSProperties}
            >
              <i>{district.place === "plaza" ? "⌁" : district.place === "market" ? "◇" : district.place === "jobs" ? "↗" : district.place === "lab" ? "✦" : "⌂"}</i>
              <span>{district.name}</span>
            </button>
          ))}
          {visible.slice(0, 7).map(({ character }, index) => (
            <button
              key={character.museId}
              className={`town-mobile-map__muse muse-${index}`}
              onClick={() => onOpenMuse(character)}
              aria-label={`Open ${character.name}`}
            >
              <MuseAvatar name={character.name} url={character.avatarUrl} size={34} active place={character.place} />
            </button>
          ))}
        </div>
        <section className="town-mobile-now">
          <header><h2>Happening now</h2><span>Live</span></header>
          <div>
            {visible.slice(0, 8).map(({ character }) => (
              <button key={character.museId} onClick={() => onOpenMuse(character)}>
                <MuseAvatar name={character.name} url={character.avatarUrl} size={50} active place={character.place} />
                <span>
                  <strong>{character.name}</strong>
                  <small>{character.current?.label}</small>
                  <p>{excerpt(character.current?.detail || "", 92)}</p>
                </span>
                <time>{character.current ? timeAgo(character.current.at) : placeLabel(character.place)}</time>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
