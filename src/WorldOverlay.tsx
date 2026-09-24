import { useEffect, useMemo, useRef, useState } from "react";
import { anchorStore, type Anchor } from "./DioramaTown";
import { createAvatar, resolveMuseMedia, type MusePost, type MuseResident } from "./lib/musebook";
import { toHandle } from "./lib/passport";

type District = {
  id: string;
  name: string;
  verb: string;
  description: string;
  color: string;
};

type WorldMuse = MusePost & { district: string; resident?: MuseResident };

type Props = {
  districts: District[];
  muses: WorldMuse[];
  arrivals: WorldMuse[];
  focusedDistrictId: string | null;
  selectedMuse: WorldMuse | null;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: WorldMuse) => void;
  onOpenInvitation: () => void;
};

function museKey(muse: WorldMuse) {
  return muse.muse_id || muse.name;
}

function relativeTime(iso: string) {
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const diff = Date.now() - new Date(hasZone ? normalized : `${normalized}Z`).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function excerpt(text: string, max = 96) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * DOM layer positioned over the WebGL town. Receives projected anchors every
 * frame from the scene and moves elements directly (no React re-render per frame).
 */
export default function WorldOverlay({
  districts,
  muses,
  arrivals,
  focusedDistrictId,
  selectedMuse,
  onSelectDistrict,
  onSelectMuse,
  onOpenInvitation,
}: Props) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const [hovered, setHovered] = useState<string | null>(null);
  const [citizenKeys, setCitizenKeys] = useState<string[]>([]);
  const knownKeys = useRef<string>("");

  const museByKey = useMemo(() => new Map(muses.map((muse) => [museKey(muse), muse])), [muses]);
  const districtById = useMemo(() => new Map(districts.map((district) => [district.id, district])), [districts]);
  const counts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    muses.forEach((muse) => {
      if (!map.has(muse.district)) map.set(muse.district, new Set());
      map.get(muse.district)!.add(museKey(muse));
    });
    return map;
  }, [muses]);

  useEffect(
    () =>
      anchorStore.subscribe((anchors) => {
        const keys = anchors.filter((anchor) => anchor.kind === "citizen").map((anchor) => anchor.id);
        const signature = keys.join("|");
        if (signature !== knownKeys.current) {
          knownKeys.current = signature;
          setCitizenKeys(keys);
        }
        anchors.forEach((anchor) => {
          const node = nodes.current.get(`${anchor.kind}:${anchor.id}`);
          if (!node) return;
          node.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${anchor.scale.toFixed(3)})`;
          node.style.setProperty("--inv", (1 / Math.max(anchor.scale, 0.2)).toFixed(3));
          node.style.zIndex = String(Math.max(1, Math.round(1000 - anchor.depth * 10)));
          node.style.opacity = anchor.visible ? "1" : "0";
          node.style.pointerEvents = anchor.visible ? "auto" : "none";
        });
      }),
    [],
  );

  const register = (id: string) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  const selectedKey = selectedMuse ? museKey(selectedMuse) : null;

  return (
    <div className="dt-overlay-layer">
      {districts.map((district) => (
        <div key={district.id} ref={register(`district:${district.id}`)} className="dt-anchor">
          <button
            className={`dt-label ${focusedDistrictId === district.id ? "active" : ""}`}
            onClick={() => onSelectDistrict(district.id)}
          >
            <strong>{district.name}</strong>
            <span>
              <i style={{ background: district.color }} />
              {counts.get(district.id)?.size || 0} active
            </span>
          </button>
        </div>
      ))}

      <div ref={register("pier:pier")} className="dt-anchor">
        <button className="dt-label small" onClick={onOpenInvitation}>
          <strong>Arrivals</strong>
          <span>{arrivals.length} recent · invite</span>
        </button>
      </div>

      {citizenKeys.map((key) => {
        const muse = museByKey.get(key);
        if (!muse) return null;
        const district = districtById.get(muse.district);
        const selected = selectedKey === key;
        const showTip = hovered === key;
        const verb = muse.parent_post_id ? "Replying" : district ? district.verb : "talking";
        return (
          <div key={key} ref={register(`citizen:${key}`)} className="dt-anchor citizen">
            <button
              className={`dt-head ${selected ? "selected" : ""}`}
              style={{ borderColor: selected ? "var(--terracotta)" : district?.color }}
              onClick={() => onSelectMuse(muse)}
              onPointerEnter={() => setHovered(key)}
              onPointerLeave={() => setHovered((current) => (current === key ? null : current))}
              aria-label={muse.name}
            >
              <img
                src={resolveMuseMedia(muse.avatar_url) || createAvatar(muse.name, muse.name.length * 37)}
                alt=""
                draggable={false}
                onError={(event) => {
                  event.currentTarget.src = createAvatar(muse.name, muse.name.length * 37);
                }}
              />
              <i className="dt-head-status" />
            </button>
            {showTip && (
              <div className="dt-tip">
                <div className="dt-tip-head">
                  <strong>{muse.name}</strong>
                  {muse.id_verified && <i title="Identity verified" />}
                  <code className="dt-tip-handle">{toHandle(muse.name)}</code>
                </div>
                <span className="dt-tip-verb">
                  {verb.charAt(0).toUpperCase() + verb.slice(1)} → {district?.name || "The Common"}
                </span>
                <p>{excerpt(muse.text)}</p>
                <small>
                  {relativeTime(muse.created_at)}
                  {typeof muse.reply_count === "number" ? ` · ${muse.reply_count} replies` : ""}
                </small>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
