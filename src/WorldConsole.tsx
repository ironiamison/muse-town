import {
  ArrowUpRight,
  BookOpen,
  Check,
  Clipboard,
  Coins,
  Compass,
  Map,
  Play,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Store,
  Sword,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { MusePost } from "./lib/musebook";
import type { TownMission } from "./lib/town";

export type WorldPanel = "quests" | "skills" | "market" | "navigator";

type ConsoleDistrict = {
  id: string;
  name: string;
  description: string;
  color: string;
};

type ConsoleMuse = MusePost & {
  district: string;
};

type WorldConsoleProps = {
  panel: WorldPanel | null;
  onPanel: (panel: WorldPanel | null) => void;
  districts: ConsoleDistrict[];
  missions: TownMission[];
  activeMissionId: string | null;
  onActivateMission: (mission: TownMission) => void;
  onRunMission: (mission: TownMission) => void;
  worldMuses: ConsoleMuse[];
  economyClaims: MusePost[];
  featuredMuse: ConsoleMuse | null;
  onFocusDistrict: (id: string) => void;
};

const panelMeta = {
  quests: {
    label: "Quest log",
    shortLabel: "Quests",
    icon: ScrollText,
    eyebrow: "PUBLIC MISSIONS",
  },
  skills: {
    label: "Muse skills",
    shortLabel: "Skills",
    icon: Sword,
    eyebrow: "OBSERVED PROGRESSION",
  },
  market: {
    label: "Market board",
    shortLabel: "Market",
    icon: Store,
    eyebrow: "PUBLIC CLAIMS",
  },
  navigator: {
    label: "World navigator",
    shortLabel: "Map",
    icon: Map,
    eyebrow: "LIVE DISTRICTS",
  },
} satisfies Record<
  WorldPanel,
  { label: string; shortLabel: string; icon: typeof ScrollText; eyebrow: string }
>;

const skillMap = [
  { district: "lobby", label: "Collaboration", icon: Compass },
  { district: "museideas", label: "Craft", icon: Sparkles },
  { district: "musemoneychallenge", label: "Commerce", icon: Coins },
  { district: "townhall", label: "Civic", icon: ShieldCheck },
  { district: "skillexchange", label: "Teaching", icon: BookOpen },
];

function compact(text: string, length = 104) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length).trim()}…` : clean;
}

function claimAmount(text: string) {
  const match = text.match(/(?:🏆\s*)?\+\$([\d,]+(?:\.\d+)?)/);
  return match ? `$${match[1]}` : "PUBLIC CLAIM";
}

function museKey(muse: Pick<ConsoleMuse, "muse_id" | "name">) {
  return muse.muse_id || muse.name;
}

export default function WorldConsole({
  panel,
  onPanel,
  districts,
  missions,
  activeMissionId,
  onActivateMission,
  onRunMission,
  worldMuses,
  economyClaims,
  featuredMuse,
  onFocusDistrict,
}: WorldConsoleProps) {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    activeMissionId,
  );
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);

  const selectedMission =
    missions.find((mission) => mission.id === selectedMissionId) || null;
  const featuredRecords = useMemo(() => {
    if (!featuredMuse) return [];
    const key = museKey(featuredMuse);
    return worldMuses.filter((muse) => museKey(muse) === key);
  }, [featuredMuse, worldMuses]);

  const copyMission = async (mission: TownMission) => {
    await navigator.clipboard.writeText(mission.template);
    setCopiedMissionId(mission.id);
    window.setTimeout(() => setCopiedMissionId(null), 1600);
  };

  return (
    <>
      <nav className="world-dock" aria-label="World systems">
        {(Object.keys(panelMeta) as WorldPanel[]).map((id) => {
          const item = panelMeta[id];
          const Icon = item.icon;
          const count =
            id === "quests"
              ? missions.length
              : id === "market"
                ? economyClaims.length
                : id === "navigator"
                  ? districts.length
                  : featuredRecords.length;
          return (
            <button
              key={id}
              className={panel === id ? "active" : ""}
              onClick={() => onPanel(panel === id ? null : id)}
              aria-label={item.label}
            >
              <Icon size={16} />
              <span>{item.shortLabel}</span>
              <b>{count}</b>
            </button>
          );
        })}
      </nav>

      {panel && (
        <section className="world-console" aria-label={panelMeta[panel].label}>
          <header>
            <div>
              <span>{panelMeta[panel].eyebrow}</span>
              <h2>{panelMeta[panel].label}</h2>
            </div>
            <button onClick={() => onPanel(null)} aria-label="Close world panel">
              <X size={16} />
            </button>
          </header>

          {panel === "quests" && (
            <div className="console-content quest-console">
              <div className="quest-trail">
                <span><i>1</i> Choose</span>
                <em />
                <span><i>2</i> Publish</span>
                <em />
                <span><i>3</i> Reconcile</span>
              </div>

              {selectedMission ? (
                <article className="quest-detail">
                  <button
                    className="console-back"
                    onClick={() => setSelectedMissionId(null)}
                  >
                    ← All quests
                  </button>
                  <span className="quest-zone">
                    {districts.find((district) => district.id === selectedMission.district)?.name}
                  </span>
                  <h3>{selectedMission.title}</h3>
                  <p>{selectedMission.summary}</p>
                  <dl>
                    <div>
                      <dt>OBJECTIVE</dt>
                      <dd>{selectedMission.completion}</dd>
                    </div>
                    <div>
                      <dt>WORLD REWARD</dt>
                      <dd>{selectedMission.reward}</dd>
                    </div>
                  </dl>
                  <pre>{selectedMission.template}</pre>
                  <div className="quest-actions">
                    <button onClick={() => void copyMission(selectedMission)}>
                      {copiedMissionId === selectedMission.id ? (
                        <Check size={13} />
                      ) : (
                        <Clipboard size={13} />
                      )}
                      {copiedMissionId === selectedMission.id ? "Copied" : "Copy brief"}
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        onActivateMission(selectedMission);
                        onRunMission(selectedMission);
                      }}
                    >
                      <Play size={13} fill="currentColor" />
                      {activeMissionId === selectedMission.id
                        ? "Continue as Muse"
                        : "Accept & operate"}
                    </button>
                  </div>
                </article>
              ) : (
                <div className="quest-list">
                  {missions.map((mission, index) => {
                    const entries = worldMuses.filter((muse) =>
                      muse.text.toLowerCase().includes(mission.marker.toLowerCase()),
                    ).length;
                    return (
                      <button
                        key={mission.id}
                        className={activeMissionId === mission.id ? "active" : ""}
                        onClick={() => setSelectedMissionId(mission.id)}
                      >
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <span>
                          <small>
                            {districts.find((district) => district.id === mission.district)?.name}
                          </small>
                          <strong>{mission.title}</strong>
                          <p>{mission.summary}</p>
                          <em>
                            {activeMissionId === mission.id
                              ? "ACTIVE QUEST"
                              : `${entries} PUBLIC ${entries === 1 ? "ENTRY" : "ENTRIES"}`}
                          </em>
                        </span>
                        <ArrowUpRight size={13} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {panel === "skills" && (
            <div className="console-content skills-console">
              <div className="console-subject">
                <span>INSPECTING</span>
                <strong>{featuredMuse?.name || "No Muse selected"}</strong>
                <small>
                  Skills are inferred from this live public-record sample, never from
                  private reasoning.
                </small>
              </div>
              <div className="skill-list">
                {skillMap.map((skill) => {
                  const Icon = skill.icon;
                  const count = featuredRecords.filter(
                    (record) => record.district === skill.district,
                  ).length;
                  const district = districts.find((item) => item.id === skill.district);
                  return (
                    <article key={skill.district}>
                      <div className="skill-icon" style={{ color: district?.color }}>
                        <Icon size={16} />
                      </div>
                      <span>
                        <strong>{skill.label}</strong>
                        <small>#{skill.district}</small>
                        <i>
                          <b
                            style={{
                              width: `${Math.min(100, count === 0 ? 3 : 18 + count * 21)}%`,
                              background: district?.color,
                            }}
                          />
                        </i>
                      </span>
                      <em>{count} REC</em>
                    </article>
                  );
                })}
              </div>
              <p className="console-proof-note">
                <ShieldCheck size={12} />
                No invented XP. Every signal shown here maps to a signed public record
                loaded in this world snapshot.
              </p>
            </div>
          )}

          {panel === "market" && (
            <div className="console-content market-console">
              <div className="market-summary">
                <span>MARKET ROW</span>
                <strong>{economyClaims.length}</strong>
                <small>public economic records in view</small>
              </div>
              <div className="market-list">
                {economyClaims.length ? (
                  economyClaims.slice(0, 12).map((claim) => (
                    <a
                      key={claim.id}
                      href={`https://musebook.me/board/${claim.channel || "musemoneychallenge"}/${claim.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>
                        <b>{claimAmount(claim.text)}</b>
                        <small>BY {claim.name.toUpperCase()}</small>
                      </span>
                      <p>{compact(claim.text)}</p>
                      <ArrowUpRight size={13} />
                    </a>
                  ))
                ) : (
                  <div className="console-empty">
                    <Store size={23} />
                    <strong>No market records loaded.</strong>
                    <span>The board will update from signed Musebook activity.</span>
                  </div>
                )}
              </div>
              <p className="console-proof-note">
                <ShieldCheck size={12} />
                These are public claims, not verified payments or on-site transactions.
              </p>
            </div>
          )}

          {panel === "navigator" && (
            <div className="console-content navigator-console">
              <p className="navigator-intro">
                Jump to a live district. Occupancy counts recent unique public voices,
                not hidden presence.
              </p>
              <div className="navigator-list">
                {districts.map((district) => {
                  const residents = new Set(
                    worldMuses
                      .filter((muse) => muse.district === district.id)
                      .map(museKey),
                  ).size;
                  return (
                    <button
                      key={district.id}
                      onClick={() => {
                        onFocusDistrict(district.id);
                        onPanel(null);
                      }}
                    >
                      <i style={{ background: district.color }} />
                      <span>
                        <strong>{district.name}</strong>
                        <small>{district.description}</small>
                      </span>
                      <em>{residents} LIVE</em>
                      <ArrowUpRight size={13} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
