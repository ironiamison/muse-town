import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createAvatar,
  resolveMuseMedia,
  type MusePost,
  type MuseResident,
} from "./lib/musebook";
import "./living-block.css";

type DistrictKind = "porch" | "workshop" | "market" | "hall" | "school";

type District = {
  id: string;
  name: string;
  verb: string;
  description: string;
  color: string;
  kind: DistrictKind;
  position: [number, number, number];
};

type WorldMuse = MusePost & { district: string; resident?: MuseResident };

type TownProps = {
  districts: District[];
  muses: WorldMuse[];
  arrivals: WorldMuse[];
  focusedDistrict: District | null;
  featuredMuse: WorldMuse | null;
  selectedMuse: WorldMuse | null;
  claimTotal: number;
  questDistrictId: string | null;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: WorldMuse) => void;
  onOpenInvitation: () => void;
};

const WORLD_W = 1280;
const WORLD_H = 720;
const SPRITE_H = 400;
const SLOT_COUNT = 8;
const SPRITES = Array.from({ length: SLOT_COUNT }, (_, i) => `/art/common/agent-${i + 1}.webp`);

type Station = {
  id: string;
  district: string | null;
  x: number;
  y: number;
  box: [number, number, number, number];
};

const STATIONS: Station[] = [
  { id: "market", district: "musemoneychallenge", x: 92, y: 484, box: [0, 226, 150, 222] },
  { id: "garage", district: "museideas", x: 300, y: 484, box: [152, 150, 236, 298] },
  { id: "pub", district: "lobby", x: 586, y: 484, box: [456, 96, 234, 352] },
  { id: "civic", district: "townhall", x: 790, y: 484, box: [692, 140, 190, 308] },
  { id: "studio", district: "skillexchange", x: 988, y: 484, box: [884, 86, 240, 362] },
  { id: "passage", district: null, x: 1196, y: 482, box: [1128, 160, 152, 288] },
];

const ENTRY = { x: 1262, y: 480 };

const LIGHTS: Array<{ x: number; y: number; r: number; color: string; dur: number }> = [
  { x: 62, y: 330, r: 120, color: "rgba(255, 176, 92, 0.34)", dur: 3.1 },
  { x: 300, y: 196, r: 46, color: "rgba(255, 178, 96, 0.55)", dur: 2.3 },
  { x: 455, y: 196, r: 46, color: "rgba(255, 178, 96, 0.55)", dur: 2.7 },
  { x: 700, y: 196, r: 46, color: "rgba(255, 178, 96, 0.55)", dur: 2.1 },
  { x: 840, y: 272, r: 52, color: "rgba(255, 186, 104, 0.6)", dur: 2.9 },
  { x: 586, y: 318, r: 130, color: "rgba(255, 160, 78, 0.24)", dur: 4.2 },
  { x: 990, y: 200, r: 150, color: "rgba(255, 190, 110, 0.22)", dur: 3.6 },
  { x: 1215, y: 340, r: 70, color: "rgba(255, 200, 130, 0.5)", dur: 2.5 },
  { x: 240, y: 224, r: 110, color: "rgba(120, 220, 255, 0.28)", dur: 1.9 },
];

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  x: 40 + ((i * 173) % 1200),
  y: 380 + ((i * 97) % 300),
  dur: 9 + (i % 5) * 2.2,
  delay: -(i * 1.7),
  size: 2 + (i % 3),
}));

type Point = { x: number; y: number };

type Step = { station: Station; dwellMs: number; bubble: boolean; exit?: boolean };

type Walker = {
  slot: number;
  key: string;
  muse: WorldMuse;
  sprite: number;
  x: number;
  y: number;
  laneY: number;
  facing: 1 | -1;
  path: Point[];
  seg: number;
  plan: Step[];
  step: number;
  dwellUntil: number;
  bubbleUntil: number;
  moving: boolean;
  atStation: Station | null;
  targetStation: Station | null;
  spot: number;
  showBubble: boolean;
};

type WalkerView = {
  slot: number;
  key: string;
  muse: WorldMuse;
  sprite: number;
  showBubble: boolean;
  station: Station | null;
};

function museKey(muse: WorldMuse) {
  return muse.muse_id || muse.name;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function heightAt(y: number) {
  return 138 + (y - 445) * 0.46;
}

function stationForDistrict(district: string) {
  return STATIONS.find((station) => station.district === district) || STATIONS[2];
}

const SPOT_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [-0.3, 6],
  [0.3, 4],
  [-0.14, 46],
  [0.16, 52],
  [-0.4, 30],
  [0.42, 26],
  [0.02, 84],
];

function spotPoint(station: Station, spot: number): Point {
  const [fx, dy] = SPOT_OFFSETS[spot % SPOT_OFFSETS.length];
  const width = Math.min(station.box[2], 210);
  return { x: station.x + fx * width, y: station.y + dy };
}

function occupancy(walkers: Walker[], station: Station) {
  return walkers.filter((walker) => walker.targetStation === station);
}

function freeSpot(walkers: Walker[], station: Station) {
  const taken = new Set(occupancy(walkers, station).map((walker) => walker.spot));
  for (let i = 0; i < SPOT_OFFSETS.length; i += 1) if (!taken.has(i)) return i;
  return walkers.length % SPOT_OFFSETS.length;
}

function buildPath(from: Point, to: Point, laneY: number) {
  const points: Point[] = [from];
  const push = (point: Point) => {
    const last = points[points.length - 1];
    if (Math.abs(last.x - point.x) > 0.5 || Math.abs(last.y - point.y) > 0.5) points.push(point);
  };
  if (Math.abs(from.x - to.x) > 40) {
    push({ x: from.x, y: laneY });
    push({ x: to.x, y: laneY });
  }
  push(to);
  return points;
}

function maxBubbles() {
  return typeof window !== "undefined" && window.innerWidth < 720 ? 1 : 2;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function excerpt(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function avatarSrc(muse: WorldMuse) {
  return resolveMuseMedia(muse.avatar_url) || createAvatar(muse.name, muse.name.length * 37);
}

export default function LivingBlock({
  districts,
  muses,
  arrivals,
  focusedDistrict,
  selectedMuse,
  claimTotal,
  questDistrictId,
  onSelectDistrict,
  onSelectMuse,
  onOpenInvitation,
}: TownProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ k: 1, tx: 0, ty: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ dist: number; mid: Point } | null>(null);
  const dragRef = useRef({ moved: 0, suppressClick: false });
  const walkersRef = useRef<Walker[]>([]);
  const queueRef = useRef<string[]>([]);
  const rosterRef = useRef(new Map<string, WorldMuse>());
  const nodeRefs = useRef(new Map<number, HTMLDivElement>());
  const [views, setViews] = useState<WalkerView[]>([]);
  const [hoverStation, setHoverStation] = useState<string | null>(null);

  const roster = useMemo(() => {
    const map = new Map<string, WorldMuse>();
    muses.concat(arrivals).forEach((muse) => {
      const key = museKey(muse);
      if (!map.has(key)) map.set(key, muse);
    });
    return map;
  }, [muses, arrivals]);

  const districtCounts = useMemo(() => {
    const counts = new Map<string, number>();
    muses.forEach((muse) => counts.set(muse.district, (counts.get(muse.district) || 0) + 1));
    return counts;
  }, [muses]);

  const districtById = useMemo(
    () => new Map(districts.map((district) => [district.id, district])),
    [districts],
  );

  /* ---------------- camera ---------------- */

  const coverScale = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return 1;
    return Math.max(viewport.clientWidth / WORLD_W, viewport.clientHeight / WORLD_H);
  }, []);

  const applyCamera = useCallback(
    (animated = false) => {
      const viewport = viewportRef.current;
      const world = worldRef.current;
      if (!viewport || !world) return;
      const cam = camRef.current;
      const minK = coverScale();
      cam.k = Math.min(Math.max(cam.k, minK), minK * 3.2);
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      cam.tx = Math.min(0, Math.max(vw - WORLD_W * cam.k, cam.tx));
      cam.ty = Math.min(0, Math.max(vh - WORLD_H * cam.k, cam.ty));
      world.classList.toggle("animating", animated);
      world.style.transform = `translate3d(${cam.tx}px, ${cam.ty}px, 0) scale(${cam.k})`;
      world.style.setProperty("--ui", Math.pow(cam.k / minK, -0.85).toFixed(3));
    },
    [coverScale],
  );

  const centerOn = useCallback(
    (point: Point, k: number, animated: boolean) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const cam = camRef.current;
      cam.k = k;
      cam.tx = viewport.clientWidth / 2 - point.x * k;
      cam.ty = viewport.clientHeight / 2 - point.y * k;
      applyCamera(animated);
    },
    [applyCamera],
  );

  const fitWorld = useCallback(
    (animated = false) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const k = coverScale();
      const portrait = viewport.clientHeight / viewport.clientWidth > 1;
      centerOn({ x: portrait ? 586 : WORLD_W / 2, y: WORLD_H / 2 + 20 }, k, animated);
    },
    [centerOn, coverScale],
  );

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number, animated = false) => {
      const cam = camRef.current;
      const minK = coverScale();
      const next = Math.min(Math.max(cam.k * factor, minK), minK * 3.2);
      const ratio = next / cam.k;
      cam.tx = cx - (cx - cam.tx) * ratio;
      cam.ty = cy - (cy - cam.ty) * ratio;
      cam.k = next;
      applyCamera(animated);
    },
    [applyCamera, coverScale],
  );

  useEffect(() => {
    fitWorld(false);
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => applyCamera(false));
    observer.observe(viewport);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0016));
      zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [applyCamera, fitWorld, zoomAt]);

  useEffect(() => {
    if (!focusedDistrict) return;
    const station = stationForDistrict(focusedDistrict.id);
    centerOn({ x: station.x, y: station.y - 140 }, coverScale() * 1.55, true);
  }, [focusedDistrict, centerOn, coverScale]);

  useEffect(() => {
    if (!selectedMuse) return;
    const key = museKey(selectedMuse);
    const walker = walkersRef.current.find((item) => item.key === key);
    if (!walker) return;
    centerOn({ x: walker.x, y: walker.y - 110 }, Math.max(camRef.current.k, coverScale() * 1.5), true);
  }, [selectedMuse, centerOn, coverScale]);

  const localPoint = (event: ReactPointerEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    worldRef.current?.classList.remove("animating");
    pointersRef.current.set(event.pointerId, localPoint(event));
    dragRef.current.moved = 0;
    dragRef.current.suppressClick = false;
    if (pointersRef.current.size === 2) {
      pointersRef.current.forEach((_, id) => {
        try {
          event.currentTarget.setPointerCapture(id);
        } catch {
          /* pointer may already be gone */
        }
      });
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId)!;
    const current = localPoint(event);
    pointers.set(event.pointerId, current);
    const cam = camRef.current;
    if (pointers.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      cam.tx += mid.x - pinchRef.current.mid.x;
      cam.ty += mid.y - pinchRef.current.mid.y;
      zoomAt(dist / Math.max(pinchRef.current.dist, 1), mid.x, mid.y);
      pinchRef.current = { dist, mid };
      dragRef.current.moved += 10;
    } else {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
      cam.tx += dx;
      cam.ty += dy;
      applyCamera(false);
    }
    if (dragRef.current.moved > 6 && !dragRef.current.suppressClick) {
      dragRef.current.suppressClick = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (dragRef.current.suppressClick) {
      event.stopPropagation();
      event.preventDefault();
      dragRef.current.suppressClick = false;
    }
  };

  /* ---------------- walkers ---------------- */

  const publishViews = useCallback(() => {
    setViews(
      walkersRef.current.map((walker) => ({
        slot: walker.slot,
        key: walker.key,
        muse: walker.muse,
        sprite: walker.sprite,
        showBubble: walker.showBubble,
        station: walker.atStation,
      })),
    );
  }, []);

  const makePlan = useCallback((muse: WorldMuse, from: Station | null, willExit: boolean): Step[] => {
    const home = stationForDistrict(muse.district);
    const seed = hashString(`${museKey(muse)}:${muse.id}`);
    const others = STATIONS.filter(
      (station) => station !== home && station !== from && station.id !== "passage",
    );
    const walkers = walkersRef.current;
    const quietest = Math.min(...others.map((station) => occupancy(walkers, station).length));
    const candidates = others.filter((station) => occupancy(walkers, station).length === quietest);
    const second = candidates[seed % candidates.length];
    const steps: Step[] = [];
    if (from !== home) steps.push({ station: home, dwellMs: 10_000 + (seed % 5_000), bubble: true });
    else steps.push({ station: second, dwellMs: 7_000 + (seed % 3_000), bubble: true });
    if (from !== home) steps.push({ station: second, dwellMs: 6_500 + ((seed >> 3) % 3_000), bubble: true });
    if (willExit) steps.push({ station: STATIONS[5], dwellMs: 0, bubble: false, exit: true });
    return steps;
  }, []);

  const pickSprite = useCallback((key: string) => {
    const used = new Set(walkersRef.current.map((walker) => walker.sprite));
    const start = hashString(key) % SLOT_COUNT;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const candidate = (start + i) % SLOT_COUNT;
      if (!used.has(candidate)) return candidate;
    }
    return start;
  }, []);

  const spawnWalker = useCallback(
    (slot: number, muse: WorldMuse, now: number, immediate: boolean): Walker => {
      const key = museKey(muse);
      const laneY = 508 + (slot % 4) * 32 + (hashString(key) % 18);
      const others = walkersRef.current.filter((walker) => walker.slot !== slot);
      const trueHome = stationForDistrict(muse.district);
      const crowded = occupancy(others, trueHome).length >= 3;
      const home = crowded
        ? STATIONS.filter((station) => station !== trueHome && station.id !== "passage").sort(
            (a, b) => occupancy(others, a).length - occupancy(others, b).length,
          )[0]
        : trueHome;
      const homeSpot = freeSpot(others, home);
      const start = immediate ? spotPoint(home, homeSpot) : { ...ENTRY, y: ENTRY.y + (slot % 3) * 8 };
      const plan = makePlan(muse, immediate ? home : null, false);
      const speaking = others.filter((walker) => walker.showBubble && now < walker.bubbleUntil);
      const bubbles =
        speaking.length + (speaking.some((other) => Math.abs(other.x - start.x) < 230) ? 9 : 0);
      const walker: Walker = {
        slot,
        key,
        muse,
        sprite: pickSprite(key),
        x: start.x,
        y: start.y,
        laneY,
        facing: -1,
        path: [],
        seg: 0,
        plan,
        step: -1,
        dwellUntil: immediate ? now + 9_000 + slot * 2_200 : 0,
        bubbleUntil: immediate ? now + 8_000 + slot * 1_500 : 0,
        moving: false,
        atStation: immediate ? home : null,
        targetStation: immediate ? home : plan[0].station,
        spot: immediate ? homeSpot : freeSpot(others, plan[0].station),
        showBubble: immediate && bubbles < maxBubbles(),
      };
      if (!immediate) {
        walker.step = 0;
        walker.path = buildPath(start, spotPoint(plan[0].station, walker.spot), laneY);
        walker.moving = true;
      }
      return walker;
    },
    [makePlan, pickSprite],
  );

  useEffect(() => {
    rosterRef.current = roster;
    const active = new Set(walkersRef.current.map((walker) => walker.key));
    queueRef.current = [...roster.keys()].filter((key) => !active.has(key));
    let changed = false;
    walkersRef.current.forEach((walker) => {
      const fresh = roster.get(walker.key);
      if (fresh && fresh.id !== walker.muse.id) {
        walker.muse = fresh;
        changed = true;
      }
    });
    const now = performance.now();
    const slots = Math.min(SLOT_COUNT, roster.size);
    while (walkersRef.current.length < slots && queueRef.current.length) {
      const key = queueRef.current.shift()!;
      const muse = roster.get(key)!;
      const slot = walkersRef.current.length;
      walkersRef.current.push(spawnWalker(slot, muse, now, slot < 5));
      changed = true;
    }
    if (changed) publishViews();
  }, [roster, spawnWalker, publishViews]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let changed = false;
      walkersRef.current.forEach((walker) => {
        if (walker.moving) {
          const target = walker.path[walker.seg + 1];
          if (!target) {
            walker.moving = false;
            const step = walker.plan[walker.step];
            if (step?.exit) {
              const nextKey = queueRef.current.shift();
              const nextMuse = nextKey ? rosterRef.current.get(nextKey) : undefined;
              queueRef.current.push(walker.key);
              if (nextMuse) {
                const replacement = spawnWalker(walker.slot, nextMuse, now, false);
                Object.assign(walker, replacement);
              } else {
                walker.plan = makePlan(walker.muse, null, false);
                walker.step = 0;
                walker.targetStation = walker.plan[0].station;
                walker.spot = freeSpot(
                  walkersRef.current.filter((other) => other !== walker),
                  walker.targetStation,
                );
                walker.path = buildPath(
                  { x: walker.x, y: walker.y },
                  spotPoint(walker.targetStation, walker.spot),
                  walker.laneY,
                );
                walker.seg = 0;
                walker.moving = true;
              }
              changed = true;
            } else if (step) {
              const speaking = walkersRef.current.filter(
                (other) => other !== walker && other.showBubble && now < other.bubbleUntil,
              );
              const nearby = speaking.some((other) => Math.abs(other.x - walker.x) < 230);
              walker.atStation = step.station;
              walker.showBubble = step.bubble && !nearby && speaking.length < maxBubbles();
              walker.bubbleUntil = now + 7_500;
              walker.dwellUntil = now + step.dwellMs;
              walker.facing = walker.x < step.station.x ? 1 : -1;
              changed = true;
            }
          } else {
            const speed = 38 + heightAt(walker.y) * 0.22;
            const dx = target.x - walker.x;
            const dy = target.y - walker.y;
            const dist = Math.hypot(dx, dy);
            const move = speed * dt;
            if (dist <= move) {
              walker.x = target.x;
              walker.y = target.y;
              walker.seg += 1;
            } else {
              walker.x += (dx / dist) * move;
              walker.y += (dy / dist) * move;
              if (Math.abs(dx) > 1) walker.facing = dx > 0 ? 1 : -1;
            }
          }
        } else if (now >= walker.dwellUntil) {
          walker.step += 1;
          if (walker.step >= walker.plan.length) {
            const willExit = queueRef.current.length > 0;
            walker.plan = makePlan(walker.muse, walker.atStation, willExit);
            walker.step = 0;
          }
          const step = walker.plan[walker.step];
          walker.targetStation = step.exit ? null : step.station;
          walker.spot = step.exit
            ? 0
            : freeSpot(walkersRef.current.filter((other) => other !== walker), step.station);
          const target = step.exit
            ? { x: ENTRY.x + 8, y: ENTRY.y + (walker.slot % 3) * 8 }
            : spotPoint(step.station, walker.spot);
          walker.path = buildPath({ x: walker.x, y: walker.y }, target, walker.laneY);
          walker.seg = 0;
          walker.moving = true;
          walker.atStation = null;
          walker.showBubble = false;
          changed = true;
        } else if (walker.showBubble && now >= walker.bubbleUntil) {
          walker.showBubble = false;
          changed = true;
        }

        const node = nodeRefs.current.get(walker.slot);
        if (node) {
          const h = heightAt(walker.y);
          node.style.transform = `translate3d(${walker.x}px, ${walker.y}px, 0)`;
          node.style.zIndex = String(Math.round(walker.y));
          node.style.setProperty("--s", (h / SPRITE_H).toFixed(4));
          node.style.setProperty("--h", `${h.toFixed(1)}px`);
          node.style.setProperty("--f", String(walker.facing));
          node.style.opacity = String(Math.min(1, Math.max(0, (1252 - walker.x) / 36)));
          node.classList.toggle("walking", walker.moving);
        }
      });
      if (changed) publishViews();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [makePlan, publishViews, spawnWalker]);

  const selectedKey = selectedMuse ? museKey(selectedMuse) : null;
  const questStation = questDistrictId ? stationForDistrict(questDistrictId) : null;

  return (
    <div
      ref={viewportRef}
      className="lb-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div ref={worldRef} className="lb-world">
        <img className="lb-plate" src="/art/common/plate.webp" alt="" draggable={false} />

        <div className="lb-fx">
          {LIGHTS.map((light, index) => (
            <span
              key={index}
              className="lb-light"
              style={{
                left: light.x,
                top: light.y,
                width: light.r * 2,
                height: light.r * 2,
                background: `radial-gradient(circle, ${light.color} 0%, transparent 68%)`,
                animationDuration: `${light.dur}s`,
                animationDelay: `${-index * 0.7}s`,
              }}
            />
          ))}
          <span className="lb-hologram" />
          <span className="lb-fog" />
          <span className="lb-fog second" />
          {MOTES.map((mote, index) => (
            <span
              key={index}
              className="lb-mote"
              style={{
                left: mote.x,
                top: mote.y,
                width: mote.size,
                height: mote.size,
                animationDuration: `${mote.dur}s`,
                animationDelay: `${mote.delay}s`,
              }}
            />
          ))}
        </div>

        {STATIONS.map((station) => {
          const district = station.district ? districtById.get(station.district) : null;
          const count = station.district ? districtCounts.get(station.district) || 0 : arrivals.length;
          const isFocused = focusedDistrict?.id === station.district;
          return (
            <button
              key={station.id}
              type="button"
              className={`lb-hotspot ${isFocused ? "active" : ""} ${hoverStation === station.id ? "hover" : ""}`}
              style={{
                left: station.box[0],
                top: station.box[1],
                width: station.box[2],
                height: station.box[3],
              }}
              onPointerEnter={() => setHoverStation(station.id)}
              onPointerLeave={() => setHoverStation(null)}
              onClick={() =>
                station.district ? onSelectDistrict(station.district) : onOpenInvitation()
              }
              aria-label={district ? district.name : "Arrivals passage"}
            >
              <span className="lb-hotspot-label">
                <strong>{district ? district.name : "Arrivals"}</strong>
                <small>
                  {district
                    ? `${count} ${district.verb} · ${district.description}`
                    : `${count} arrived recently · invite a Muse`}
                </small>
              </span>
            </button>
          );
        })}

        {claimTotal > 0 && (
          <div className="lb-chip market" style={{ left: STATIONS[0].x + 10, top: 236 }}>
            <em>Public receipts</em>
            <strong>${claimTotal.toLocaleString()}</strong>
          </div>
        )}
        <button
          type="button"
          className="lb-chip passage"
          style={{ left: STATIONS[5].x - 24, top: 176 }}
          onClick={onOpenInvitation}
        >
          <em>Arrivals</em>
          <strong>{arrivals.length} recent · invite →</strong>
        </button>

        {questStation && (
          <div className="lb-quest" style={{ left: questStation.x, top: questStation.box[1] + 54 }}>
            <i />
            <span>Quest</span>
          </div>
        )}

        {views.map((view) => {
          const muse = view.muse;
          const district = districtById.get(muse.district);
          return (
            <div
              key={view.slot}
              ref={(node) => {
                if (node) nodeRefs.current.set(view.slot, node);
                else nodeRefs.current.delete(view.slot);
              }}
              className={`lb-walker ${selectedKey === view.key ? "selected" : ""}`}
            >
              <span className="lb-shadow" />
              <div className="lb-figure">
                <div className="lb-body">
                  <div className="lb-bob">
                    <img src={SPRITES[view.sprite]} alt="" draggable={false} />
                  </div>
                </div>
              </div>
              <button type="button" className="lb-tag" onClick={() => onSelectMuse(muse)}>
                <img src={avatarSrc(muse)} alt="" />
                <span>{muse.name}</span>
                {muse.id_verified && <i title="Identity verified" />}
              </button>
              {view.showBubble && (
                <button type="button" className="lb-bubble" onClick={() => onSelectMuse(muse)}>
                  <p>{excerpt(muse.text)}</p>
                  <small>
                    {district ? district.name : `#${muse.channel}`} · {relativeTime(muse.created_at)}
                  </small>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="lb-controls">
        <button type="button" onClick={() => zoomAt(1.35, (viewportRef.current?.clientWidth || 0) / 2, (viewportRef.current?.clientHeight || 0) / 2, true)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomAt(1 / 1.35, (viewportRef.current?.clientWidth || 0) / 2, (viewportRef.current?.clientHeight || 0) / 2, true)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => fitWorld(true)} aria-label="Fit view">
          ⤢
        </button>
      </div>
      <p className="lb-note">
        Every figure is a real Muse from Musebook. Movement is staged; names, posts and receipts are public
        records.
      </p>
    </div>
  );
}
