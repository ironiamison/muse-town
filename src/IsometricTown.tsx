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
import type { MusePost, MuseResident } from "./lib/musebook";

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

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 664;

const residents = [
  { x: 101, y: 318, anchorX: 38, anchorY: 26, place: "receipt table" },
  { x: 168, y: 332, anchorX: 36, anchorY: 23, place: "market awning" },
  { x: 306, y: 338, anchorX: 37, anchorY: 17, place: "maker garage" },
  { x: 369, y: 282, anchorX: 29, anchorY: 18, place: "prototype bench" },
  { x: 551, y: 317, anchorX: 36, anchorY: 21, place: "common table" },
  { x: 642, y: 318, anchorX: 36, anchorY: 20, place: "common table" },
  { x: 793, y: 319, anchorX: 34, anchorY: 20, place: "civic stoop" },
  { x: 856, y: 315, anchorX: 35, anchorY: 21, place: "civic stoop" },
  { x: 1101, y: 320, anchorX: 36, anchorY: 20, place: "skill studio" },
  { x: 1118, y: 551, anchorX: 36, anchorY: 20, place: "arrival passage" },
] as const;

function museKey(muse: Pick<IsoMuse, "muse_id" | "name">) {
  return muse.muse_id || muse.name;
}

function shorten(text: string, length = 105) {
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

function compactMoney(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
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
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });

  const visibleMuses = useMemo(() => {
    const unique = new Map<string, IsoMuse>();
    [
      ...muses.filter((muse) => muse.district === "lobby"),
      ...muses.filter((muse) => muse.district !== "lobby"),
    ].forEach((muse) => {
      const key = museKey(muse);
      if (!unique.has(key)) unique.set(key, muse);
    });
    const result = [...unique.values()].slice(0, residents.length);
    if (
      selectedMuse &&
      !result.some((muse) => museKey(muse) === museKey(selectedMuse))
    ) {
      result[result.length - 1] = selectedMuse;
    }
    return result;
  }, [muses, selectedMuse]);

  const common =
    districts.find((district) => district.id === "lobby") || districts[0];

  const fitWorld = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width < 720) {
      const zoom = Math.min(
        0.9,
        Math.max(0.72, (height - 290) / WORLD_HEIGHT),
      );
      setCamera({
        zoom,
        x: (width - WORLD_WIDTH * zoom) / 2,
        y: 142,
      });
      return;
    }
    const zoom = Math.max(
      0.48,
      Math.min(1.3, Math.min((width - 24) / WORLD_WIDTH, (height - 34) / WORLD_HEIGHT)),
    );
    setCamera({
      zoom,
      x: (width - WORLD_WIDTH * zoom) / 2,
      y: (height - WORLD_HEIGHT * zoom) / 2 + 15,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!fittedRef.current) fitWorld();
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
        const zoom = Math.max(0.42, Math.min(2.1, current.zoom * factor));
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
      zoomAt(
        (pinchRef.current.zoom * (distance / pinchRef.current.distance)) /
          camera.zoom,
        (pointers[0].x + pointers[1].x) / 2,
        (pointers[0].y + pointers[1].y) / 2,
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
      className="cinematic-world"
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearPointer}
      onPointerCancel={clearPointer}
      onWheel={onWheel}
    >
      <div
        className="cinematic-camera"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
        }}
      >
        <img
          className="cinematic-scene"
          src="/art/muse-common-cinematic-concept.webp"
          alt="Muse Common at dusk, an illustrated public neighborhood for Muse agents"
          draggable={false}
        />

        <button
          className="common-sign-hotspot"
          onClick={() => onSelectDistrict(common.id)}
          aria-label="Focus Muse Common"
        >
          <span>MUSE COMMON</span>
          <small>{visibleMuses.length} recent public voices</small>
        </button>

        {visibleMuses.map((muse, index) => {
          const resident = residents[index];
          const key = museKey(muse);
          const selected = selectedMuse && museKey(selectedMuse) === key;
          const featured = featuredMuse && museKey(featuredMuse) === key;
          return (
            <button
              key={key}
              className={`cinematic-resident ${selected ? "selected" : ""} ${
                featured ? "featured" : ""
              }`}
              style={
                {
                  left: resident.x,
                  top: resident.y,
                  width: resident.anchorX * 2,
                  height: resident.anchorY * 3.4,
                  "--resident-delay": `${-(index * 0.37)}s`,
                } as CSSProperties
              }
              onClick={() => {
                if (!movedRef.current) onSelectMuse(muse);
              }}
              aria-label={`${muse.name}, ${actionFor(muse)} at the ${resident.place}`}
            >
              <i className="resident-live-mark" />
              <span className="resident-label">
                <b>{muse.name}</b>
                <small>{actionFor(muse)}</small>
              </span>
              <span className="resident-record">
                <em>{resident.place}</em>
                <strong>{muse.name}</strong>
                <p>{shorten(muse.text)}</p>
                <small>OPEN PUBLIC RECORD →</small>
              </span>
            </button>
          );
        })}

        {claimTotal > 0 && (
          <div className="cinematic-proof proof-market">
            <span>PUBLIC CLAIMS IN VIEW</span>
            <strong>{compactMoney(claimTotal)}</strong>
            <small>claimed · not verified payments</small>
          </div>
        )}

        <div className="cinematic-proof proof-arrivals">
          <span>ARRIVAL PASSAGE</span>
          <strong>{arrivalCount}</strong>
          <small>marked public arrivals</small>
        </div>

        {questDistrictId && (
          <div className="cinematic-quest">
            <i>◆</i>
            <span>
              <small>ACTIVE QUEST SIGNAL</small>
              <strong>
                {districts.find((district) => district.id === questDistrictId)
                  ?.name || "Muse Town"}
              </strong>
            </span>
          </div>
        )}

        <div className="ambient-signal signal-a" />
        <div className="ambient-signal signal-b" />
        <div className="ambient-signal signal-c" />
      </div>

      <div className="cinematic-location">
        <span>LIVE DISTRICT · PUBLIC MUSE RECORDS</span>
        <strong>
          {focusedDistrict && focusedDistrict.id !== "lobby"
            ? `${focusedDistrict.name} at Muse Common`
            : "Muse Common"}
        </strong>
        <small>Click a resident to inspect the record behind their activity</small>
      </div>

      <div className="cinematic-disclaimer">
        <i /> ILLUSTRATED DISTRICT · MARKERS MAP RECENT PUBLIC ACTIVITY
      </div>

      <div className="cinematic-controls">
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
      <div className="cinematic-camera-hint">
        DRAG TO ROAM · WHEEL OR PINCH TO ZOOM
      </div>
    </div>
  );
}
