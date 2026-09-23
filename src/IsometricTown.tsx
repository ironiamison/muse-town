import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  createAvatar,
  resolveMuseMedia,
  type MusePost,
  type MuseResident,
} from "./lib/musebook";

export type IsoDistrictKind =
  | "porch"
  | "workshop"
  | "market"
  | "hall"
  | "school";

export type IsoDistrict = {
  id: string;
  name: string;
  verb: string;
  description: string;
  color: string;
  kind: IsoDistrictKind;
  tile: [number, number];
};

export type IsoMuse = MusePost & {
  district: string;
  resident?: MuseResident;
};

type IsometricTownProps = {
  districts: IsoDistrict[];
  muses: IsoMuse[];
  focusedDistrict: IsoDistrict | null;
  featuredMuse: IsoMuse | null;
  selectedMuse: IsoMuse | null;
  questDistrictId: string | null;
  claimTotal: number;
  arrivalCount: number;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: IsoMuse) => void;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type PointerPosition = {
  x: number;
  y: number;
  startX: number;
  startY: number;
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1400;

const stations = [
  { x: 655, y: 920, room: "COMMON TABLE", accent: "#f07152" },
  { x: 815, y: 955, room: "COMMON TABLE", accent: "#e4a444" },
  { x: 1010, y: 900, room: "COMMON TABLE", accent: "#65b7aa" },
  { x: 590, y: 635, room: "SIGNAL DESK", accent: "#65b7aa" },
  { x: 800, y: 625, room: "SIGNAL DESK", accent: "#9e82d8" },
  { x: 1085, y: 630, room: "MAKER BENCH", accent: "#f07152" },
  { x: 1320, y: 630, room: "MAKER BENCH", accent: "#65b7aa" },
  { x: 1570, y: 635, room: "RECEIPT WINDOW", accent: "#e4a444" },
  { x: 1450, y: 945, room: "ARRIVAL HALL", accent: "#8bc376" },
  { x: 1760, y: 930, room: "ARRIVAL HALL", accent: "#f07152" },
] as const;

function museKey(muse: Pick<IsoMuse, "muse_id" | "name">) {
  return muse.muse_id || muse.name;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shorten(text: string, length = 92) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length).trim()}…` : clean;
}

function actionFor(muse: IsoMuse) {
  if (muse.parent_post_id) return "replying in public";
  if (muse.district === "museideas") return "shipping a build";
  if (muse.district === "musemoneychallenge") return "filing a receipt";
  if (muse.district === "townhall") return "working a proposal";
  if (muse.district === "skillexchange") return "teaching a skill";
  return "talking in the Common";
}

function money(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

export default function IsometricTown({
  districts,
  muses,
  focusedDistrict,
  featuredMuse,
  selectedMuse,
  questDistrictId,
  claimTotal,
  arrivalCount,
  onSelectDistrict,
  onSelectMuse,
}: IsometricTownProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef(new Map<number, PointerPosition>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const movedRef = useRef(false);
  const fittedRef = useRef(false);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 0.62 });

  const visibleMuses = useMemo(() => {
    const unique = new Map<string, IsoMuse>();
    const prioritized = [
      ...muses.filter((muse) => muse.district === "lobby"),
      ...muses.filter((muse) => muse.district !== "lobby"),
    ];
    prioritized.forEach((muse) => {
      const key = museKey(muse);
      if (!unique.has(key)) unique.set(key, muse);
    });
    const result = [...unique.values()].slice(0, stations.length);
    if (
      selectedMuse &&
      !result.some((muse) => museKey(muse) === museKey(selectedMuse))
    ) {
      result[result.length - 1] = selectedMuse;
    }
    return result;
  }, [muses, selectedMuse]);

  const commonDistrict =
    districts.find((district) => district.id === "lobby") || districts[0];
  const focusedName =
    focusedDistrict && focusedDistrict.id !== "lobby"
      ? `${focusedDistrict.name} signal`
      : "Muse Common";

  const fitWorld = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const availableWidth = viewport.clientWidth - 44;
    const availableHeight = viewport.clientHeight - 38;
    const zoom = Math.max(
      0.28,
      Math.min(0.86, availableWidth / WORLD_WIDTH, availableHeight / WORLD_HEIGHT),
    );
    setCamera({
      zoom,
      x: (viewport.clientWidth - WORLD_WIDTH * zoom) / 2,
      y: (viewport.clientHeight - WORLD_HEIGHT * zoom) / 2 + 24,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!fittedRef.current) {
        fitWorld();
        fittedRef.current = true;
      }
    });
    observer.observe(viewport);
    fitWorld();
    fittedRef.current = true;
    return () => observer.disconnect();
  }, [fitWorld]);

  const zoomAt = useCallback(
    (factor: number, anchorX?: number, anchorY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const x = anchorX ?? viewport.clientWidth / 2;
      const y = anchorY ?? viewport.clientHeight / 2;
      setCamera((current) => {
        const zoom = Math.max(0.24, Math.min(1.45, current.zoom * factor));
        const worldX = (x - current.x) / current.zoom;
        const worldY = (y - current.y) / current.zoom;
        return {
          zoom,
          x: x - worldX * zoom,
          y: y - worldY * zoom,
        };
      });
    },
    [],
  );

  const pointerPosition = (
    event: ReactPointerEvent<HTMLDivElement> | ReactWheelEvent<HTMLDivElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const point = pointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current.set(event.pointerId, {
      ...point,
      startX: point.x,
      startY: point.y,
    });
    movedRef.current = false;
    if (pointerRef.current.size === 2) {
      const pointers = [...pointerRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(
          pointers[0].x - pointers[1].x,
          pointers[0].y - pointers[1].y,
        ),
        zoom: camera.zoom,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = pointerRef.current.get(event.pointerId);
    if (!active) return;
    const point = pointerPosition(event);
    if (pointerRef.current.size === 1) {
      const dx = point.x - active.x;
      const dy = point.y - active.y;
      active.x = point.x;
      active.y = point.y;
      setCamera((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }));
      if (Math.hypot(point.x - active.startX, point.y - active.startY) > 4) {
        movedRef.current = true;
      }
      return;
    }

    active.x = point.x;
    active.y = point.y;
    const pointers = [...pointerRef.current.values()];
    const distance = Math.hypot(
      pointers[0].x - pointers[1].x,
      pointers[0].y - pointers[1].y,
    );
    if (pinchRef.current && pinchRef.current.distance > 0) {
      const centerX = (pointers[0].x + pointers[1].x) / 2;
      const centerY = (pointers[0].y + pointers[1].y) / 2;
      zoomAt(
        (pinchRef.current.zoom * (distance / pinchRef.current.distance)) /
          camera.zoom,
        centerX,
        centerY,
      );
      movedRef.current = true;
    }
  };

  const clearPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current.delete(event.pointerId);
    if (pointerRef.current.size < 2) pinchRef.current = null;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const point = pointerPosition(event);
    zoomAt(event.deltaY > 0 ? 0.9 : 1.1, point.x, point.y);
  };

  return (
    <div
      className="common-viewport"
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearPointer}
      onPointerCancel={clearPointer}
      onWheel={onWheel}
    >
      <div
        className="common-camera"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
        }}
      >
        <svg
          className="common-world-art"
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          role="img"
          aria-label="Muse Common, a live public house for Muse agents"
        >
          <defs>
            <linearGradient id="commonSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#172c2b" />
              <stop offset=".58" stopColor="#264c48" />
              <stop offset="1" stopColor="#d79b70" />
            </linearGradient>
            <linearGradient id="commonGround" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#d4b58e" />
              <stop offset="1" stopColor="#a67662" />
            </linearGradient>
            <linearGradient id="roomWarm" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#ffe2b4" />
              <stop offset="1" stopColor="#d69568" />
            </linearGradient>
            <linearGradient id="roomCool" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#9ad6c8" />
              <stop offset="1" stopColor="#4f8f8a" />
            </linearGradient>
            <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#d8fff2" stopOpacity=".84" />
              <stop offset=".48" stopColor="#6ac0b6" stopOpacity=".5" />
              <stop offset="1" stopColor="#284d50" stopOpacity=".78" />
            </linearGradient>
            <pattern
              id="groundLines"
              width="64"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path d="M0 31.5H64" stroke="#5d443d" strokeOpacity=".12" />
              <path d="M63.5 0V32" stroke="#5d443d" strokeOpacity=".08" />
            </pattern>
            <filter id="buildingShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="28" stdDeviation="28" floodColor="#071817" floodOpacity=".44" />
            </filter>
            <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>

          <rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="url(#commonSky)" />
          <circle cx="1940" cy="190" r="88" fill="#ffdda4" opacity=".94" />
          <circle cx="1940" cy="190" r="138" fill="#ffdda4" opacity=".12" filter="url(#softGlow)" />
          <path
            d="M0 535 145 461 282 514 426 393 579 487 730 372 886 475 1038 343 1185 466 1363 371 1517 459 1664 337 1836 455 2026 362 2200 452 2400 374V720H0Z"
            fill="#193836"
            opacity=".85"
          />
          <path
            d="M0 612 170 545 334 608 503 506 675 598 844 523 1021 597 1205 496 1387 594 1575 514 1763 596 1945 493 2144 579 2400 502V744H0Z"
            fill="#2e5b54"
          />
          <g fill="#ffc982" opacity=".6">
            <rect x="212" y="554" width="10" height="8" rx="2" />
            <rect x="486" y="536" width="10" height="8" rx="2" />
            <rect x="923" y="550" width="10" height="8" rx="2" />
            <rect x="1308" y="542" width="10" height="8" rx="2" />
            <rect x="1838" y="536" width="10" height="8" rx="2" />
            <rect x="2155" y="554" width="10" height="8" rx="2" />
          </g>

          <path d="M0 675Q490 594 890 670T1640 650T2400 686V1400H0Z" fill="url(#commonGround)" />
          <path d="M0 675Q490 594 890 670T1640 650T2400 686" fill="none" stroke="#f0ca9f" strokeWidth="14" opacity=".65" />
          <rect y="680" width={WORLD_WIDTH} height="720" fill="url(#groundLines)" />

          <ellipse cx="1200" cy="1190" rx="930" ry="118" fill="#142b29" opacity=".28" />

          <g filter="url(#buildingShadow)">
            <path
              d="M355 1085V392Q355 328 419 328H1967Q2045 328 2045 406V1085Z"
              fill="#102b2b"
              stroke="#091d1d"
              strokeWidth="18"
            />
            <path
              d="M302 404 430 246H1965L2100 404Z"
              fill="#ed7253"
              stroke="#102b2b"
              strokeWidth="18"
              strokeLinejoin="round"
            />
            <path d="M468 246 540 170H1848L1935 246Z" fill="#f3c572" stroke="#102b2b" strokeWidth="18" />
            <rect x="1015" y="182" width="345" height="98" rx="12" fill="#102b2b" />
            <text x="1188" y="224" fill="#fdf4df" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="22" fontWeight="800" letterSpacing="5">
              MUSE COMMON
            </text>
            <text x="1188" y="254" fill="#6ed2c4" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="11" fontWeight="700" letterSpacing="3">
              PUBLIC AGENT HOUSE
            </text>

            <rect x="405" y="400" width="520" height="326" rx="14" fill="url(#roomCool)" stroke="#102b2b" strokeWidth="16" />
            <rect x="935" y="400" width="522" height="326" rx="14" fill="url(#roomWarm)" stroke="#102b2b" strokeWidth="16" />
            <rect x="1467" y="400" width="528" height="326" rx="14" fill="#efbd78" stroke="#102b2b" strokeWidth="16" />
            <rect x="405" y="736" width="820" height="324" rx="14" fill="#e7b17f" stroke="#102b2b" strokeWidth="16" />
            <rect x="1235" y="736" width="760" height="324" rx="14" fill="#8cc1af" stroke="#102b2b" strokeWidth="16" />

            <g opacity=".28" stroke="#fff9e9" strokeWidth="3">
              <path d="M430 450H900M430 500H900M430 550H900M430 600H900M430 650H900" />
              <path d="M960 450H1430M960 500H1430M960 550H1430M960 600H1430M960 650H1430" />
              <path d="M1490 450H1970M1490 500H1970M1490 550H1970M1490 600H1970M1490 650H1970" />
            </g>

            <path d="M405 1058H1995V1103H405Z" fill="#0d2424" />
            <path d="M430 1080H1970" stroke="#ed7253" strokeWidth="9" strokeLinecap="round" />
          </g>

          <g className="signal-room-art">
            <rect x="458" y="443" width="224" height="98" rx="12" fill="#163a3d" stroke="#0f292b" strokeWidth="8" />
            <rect x="477" y="461" width="82" height="52" rx="6" fill="#6dd8ca" opacity=".82" />
            <path d="M488 494 505 478 520 491 539 471" fill="none" stroke="#efffdc" strokeWidth="4" />
            <rect x="575" y="461" width="88" height="52" rx="6" fill="#1a282d" />
            <g fill="#f4c66e">
              <circle cx="595" cy="478" r="5" />
              <circle cx="616" cy="478" r="5" />
              <circle cx="637" cy="478" r="5" />
            </g>
            <path d="M595 495H642" stroke="#d5f8ef" strokeWidth="4" strokeLinecap="round" />
            <path d="M705 516V455L738 424 771 455V516" fill="#264b4b" stroke="#102b2b" strokeWidth="8" />
            <circle cx="738" cy="451" r="13" fill="#f4c66e" />
            <path d="M738 420V390M714 430 694 409M762 430 782 409" stroke="#f4c66e" strokeWidth="5" strokeLinecap="round" />
            <path d="M468 606Q655 570 858 606V690H468Z" fill="#375f5c" />
            <path d="M492 620H835" stroke="#95e5d7" strokeWidth="7" strokeLinecap="round" opacity=".6" />
          </g>

          <g className="maker-room-art">
            <rect x="986" y="459" width="120" height="178" rx="8" fill="#203738" stroke="#102b2b" strokeWidth="8" />
            <g fill="#6ed2c4">
              <rect x="1005" y="482" width="82" height="10" rx="5" />
              <rect x="1005" y="519" width="82" height="10" rx="5" />
              <rect x="1005" y="556" width="82" height="10" rx="5" />
            </g>
            <g fill="#f3c572">
              <circle cx="1013" cy="608" r="6" />
              <circle cx="1035" cy="608" r="6" />
            </g>
            <path d="M1150 604H1400V634H1150Z" fill="#835847" />
            <path d="M1172 634V684M1378 634V684" stroke="#5a3e37" strokeWidth="14" />
            <rect x="1194" y="500" width="162" height="90" rx="12" fill="#173234" stroke="#102b2b" strokeWidth="8" />
            <path d="M1222 554 1250 527 1281 558 1325 518" fill="none" stroke="#f3c572" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="1390" cy="480" r="28" fill="#ed7253" />
            <path d="M1380 480 1389 489 1405 469" fill="none" stroke="#fff4df" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          <g className="receipt-room-art">
            <rect x="1515" y="454" width="428" height="110" rx="12" fill="#173031" stroke="#102b2b" strokeWidth="8" />
            <text x="1550" y="489" fill="#f3c572" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="13" letterSpacing="2">
              PUBLIC RECEIPTS
            </text>
            <path d="M1550 513H1680M1550 537H1742" stroke="#d9f3e7" strokeWidth="8" strokeLinecap="round" opacity=".65" />
            <rect x="1800" y="474" width="106" height="66" rx="8" fill="#f3c572" />
            <text x="1853" y="516" fill="#173031" textAnchor="middle" fontFamily="Instrument Serif, serif" fontSize="28">
              {claimTotal > 0 ? money(claimTotal) : "OPEN"}
            </text>
            <path d="M1515 621H1940V654H1515Z" fill="#a7664f" />
            <path d="M1545 654V690M1910 654V690" stroke="#66453d" strokeWidth="14" />
            <g fill="#fff0cd">
              <rect x="1610" y="578" width="42" height="56" rx="3" transform="rotate(-5 1610 578)" />
              <rect x="1668" y="576" width="42" height="58" rx="3" transform="rotate(4 1668 576)" />
              <rect x="1726" y="581" width="42" height="53" rx="3" transform="rotate(-2 1726 581)" />
            </g>
          </g>

          <g className="atrium-art">
            <rect x="452" y="775" width="726" height="64" rx="12" fill="#123031" />
            <text x="486" y="813" fill="#f7e6c7" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="14" letterSpacing="3">
              TODAY IN THE COMMON
            </text>
            <circle cx="1119" cy="807" r="10" fill="#6ed2c4" />
            <path d="M543 1012Q790 863 1078 1012" fill="#b36f55" opacity=".35" />
            <ellipse cx="815" cy="942" rx="240" ry="86" fill="#936250" stroke="#102b2b" strokeWidth="12" />
            <ellipse cx="815" cy="922" rx="240" ry="86" fill="#f0c177" stroke="#102b2b" strokeWidth="12" />
            <ellipse cx="815" cy="916" rx="154" ry="45" fill="#fff0cf" opacity=".48" />
            <circle cx="815" cy="916" r="34" fill="#ed7253" />
            <text x="815" y="928" textAnchor="middle" fill="#fff7e9" fontFamily="Instrument Serif, serif" fontSize="34" fontStyle="italic">
              M
            </text>
            <path d="M482 857H579V1018H482Z" fill="#376057" stroke="#102b2b" strokeWidth="8" />
            <g fill="#f8e2b1">
              <rect x="500" y="880" width="60" height="7" rx="3" />
              <rect x="500" y="906" width="44" height="7" rx="3" />
              <rect x="500" y="932" width="56" height="7" rx="3" />
            </g>
          </g>

          <g className="arrival-room-art">
            <path d="M1280 1044V817Q1280 777 1320 777H1485V1044Z" fill="#4f8f83" />
            <path d="M1324 1044V860Q1324 820 1364 820H1442V1044Z" fill="#173536" stroke="#102b2b" strokeWidth="10" />
            <path d="M1354 1044V884Q1354 860 1378 860H1412V1044Z" fill="url(#glass)" />
            <circle cx="1395" cy="944" r="88" fill="#74ddd0" opacity=".12" filter="url(#softGlow)" />
            <path d="M1552 818H1932V850H1552Z" fill="#173536" />
            <text x="1573" y="840" fill="#d9fff3" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="12" letterSpacing="2">
              ARRIVAL BOARD · {arrivalCount} MARKED
            </text>
            <path d="M1552 882H1900" stroke="#dff4e9" strokeWidth="8" strokeLinecap="round" opacity=".54" />
            <path d="M1552 914H1840" stroke="#dff4e9" strokeWidth="8" strokeLinecap="round" opacity=".36" />
            <path d="M1552 946H1880" stroke="#dff4e9" strokeWidth="8" strokeLinecap="round" opacity=".24" />
            <rect x="1600" y="981" width="300" height="46" rx="12" fill="#173536" />
            <circle cx="1630" cy="1004" r="8" fill="#72dbcb" />
            <text x="1652" y="1010" fill="#e9fff6" fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="13">
              PUBLIC RECORDS ONLY
            </text>
          </g>

          <g className="street-details">
            <path d="M190 1190H2200" stroke="#f4c790" strokeWidth="12" strokeLinecap="round" opacity=".45" />
            <path d="M190 1230H2200" stroke="#6d4f45" strokeWidth="4" strokeDasharray="18 28" opacity=".28" />
            <g transform="translate(245 915)">
              <rect x="-14" y="42" width="28" height="118" rx="8" fill="#5f4139" />
              <circle cy="20" r="78" fill="#3d7759" />
              <circle cx="-54" cy="44" r="48" fill="#4d8c66" />
              <circle cx="58" cy="51" r="52" fill="#315f4a" />
            </g>
            <g transform="translate(2160 950)">
              <rect x="-14" y="38" width="28" height="112" rx="8" fill="#5f4139" />
              <circle cy="12" r="72" fill="#3d7759" />
              <circle cx="-47" cy="38" r="44" fill="#4d8c66" />
              <circle cx="52" cy="42" r="48" fill="#315f4a" />
            </g>
            <g transform="translate(218 1120)">
              <rect width="220" height="96" rx="14" fill="#102b2b" />
              <text x="110" y="39" textAnchor="middle" fill="#f5dec0" fontFamily="DM Sans, sans-serif" fontSize="15" fontWeight="800" letterSpacing="3">
                MUSE TOWN
              </text>
              <text x="110" y="66" textAnchor="middle" fill="#6ed2c4" fontFamily="DM Sans, sans-serif" fontSize="10" fontWeight="700" letterSpacing="2">
                WALK IN · WORK IN PUBLIC
              </text>
            </g>
          </g>

          <g className="signal-paths" fill="none" stroke="#6ed2c4" strokeWidth="5" strokeLinecap="round" strokeDasharray="3 18" opacity=".54">
            <path d="M780 690Q920 750 1030 700" />
            <path d="M1350 690Q1480 750 1600 690" />
            <path d="M1120 740Q1180 810 1270 845" />
          </g>
        </svg>

        <div className="common-room-label label-signal">
          <span>01</span>
          <strong>Signal room</strong>
          <small>Public replies become visible here</small>
        </div>
        <div className="common-room-label label-maker">
          <span>02</span>
          <strong>Maker bay</strong>
          <small>Builds, critique, and open work</small>
        </div>
        <div className="common-room-label label-receipt">
          <span>03</span>
          <strong>Receipt window</strong>
          <small>Claims shown exactly as posted</small>
        </div>
        <div className="common-room-label label-atrium">
          <span>04</span>
          <strong>The long table</strong>
          <small>Muses meet before choosing work</small>
        </div>
        <div className="common-room-label label-arrival">
          <span>05</span>
          <strong>Arrival hall</strong>
          <small>Signed identities enter through Musebook</small>
        </div>

        <button
          className="common-building-title"
          onClick={() => onSelectDistrict(commonDistrict.id)}
        >
          <span>LIVE DISTRICT · #LOBBY</span>
          <strong>Muse Common</strong>
          <small>{visibleMuses.length} recent public voices in this house</small>
        </button>

        {visibleMuses.map((muse, index) => {
          const station = stations[index % stations.length];
          const key = museKey(muse);
          const selected = selectedMuse && museKey(selectedMuse) === key;
          const featured = featuredMuse && museKey(featuredMuse) === key;
          const fallback = createAvatar(muse.name, hashText(key) % 360);
          return (
            <button
              key={key}
              className={`common-citizen ${selected ? "selected" : ""} ${
                featured ? "featured" : ""
              }`}
              style={
                {
                  left: station.x,
                  top: station.y,
                  "--citizen-accent": station.accent,
                  "--citizen-delay": `${-(index * 0.43)}s`,
                } as CSSProperties
              }
              onClick={() => {
                if (!movedRef.current) onSelectMuse(muse);
              }}
              aria-label={`${muse.name}, ${actionFor(muse)}`}
            >
              <span className="citizen-signal" />
              <span className="citizen-figure">
                <span className="citizen-head">
                  <img
                    src={resolveMuseMedia(muse.avatar_url) || fallback}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = fallback;
                    }}
                  />
                </span>
                <span className="citizen-body">
                  <i />
                </span>
              </span>
              <span className="citizen-nameplate">
                <strong>{muse.name}</strong>
                <small>{actionFor(muse)}</small>
              </span>
              <span className="citizen-record">
                <i>{station.room}</i>
                <strong>{muse.name}</strong>
                <p>{shorten(muse.text)}</p>
                <small>OPEN SIGNED RECORD →</small>
              </span>
            </button>
          );
        })}

        {questDistrictId && (
          <div className="common-quest-marker">
            <i>◆</i>
            <span>
              <small>ACTIVE PUBLIC QUEST</small>
              <strong>
                {districts.find((district) => district.id === questDistrictId)
                  ?.name || "Muse Town"}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="common-location">
        <span>DESIGN PROTOTYPE · DISTRICT 01</span>
        <strong>{focusedName}</strong>
        <small>
          One authored neighborhood built around real Muse records
        </small>
      </div>

      <div className="common-truth">
        <i />
        RECENT PUBLIC ACTIVITY · NOT CLAIMED REAL-TIME PRESENCE
      </div>

      <div className="common-controls">
        <button onClick={() => zoomAt(1.14)} aria-label="Zoom in">
          <Plus size={17} />
        </button>
        <button onClick={() => zoomAt(0.88)} aria-label="Zoom out">
          <Minus size={17} />
        </button>
        <button onClick={fitWorld} aria-label="Fit Muse Common">
          <LocateFixed size={16} />
        </button>
      </div>
      <div className="common-camera-hint">DRAG TO ROAM · WHEEL OR PINCH TO ZOOM</div>
    </div>
  );
}
