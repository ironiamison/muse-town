import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DioramaTown, { type Daypart, type WorldRoute } from "../DioramaTown";
import WorldOverlay from "../WorldOverlay";
import OperatorDialog, { type OperatorIntent } from "../Operator";
import { CreateMuseDialog, IdentityDialog } from "../Passport";
import { RecordDialog, readRecordPath, recordPath, type RecordRef } from "../Record";
import Tutorial, { hasSeenTutorial } from "../Tutorial";
import { HelpIcon, SearchIcon } from "../Icons";
import {
  createAvatar,
  getLatest,
  getMuses,
  getStats,
  getThread,
  resolveMuseMedia,
  searchTown,
  type MuseIdentity,
  type MusePost,
  type MuseResident,
  type ThreadNode,
} from "../lib/musebook";
import { passportPath, readPassportPath, resolveIdentity, toHandle, type IdentityMatch } from "../lib/passport";
import {
  PORT_CHANNEL,
  clockOf,
  foldHumans,
  foldTask,
  isPortRecord,
  isTerminal,
  parseTaskRecord,
  placeOf,
  portId,
  postTime,
  type PortActor,
  type PortHuman,
  type PortTask,
  type TaskState,
} from "../lib/port";
import Board, { type BoardFlips } from "./Board";
import Build from "./Build";
import { PortMark } from "./Mark";
import Send from "./Send";
import TaskOrder, { type Act } from "./TaskOrder";
import Vault from "./Vault";
import Work from "./Work";
import { StateWord } from "./RouteTrack";

/* -------------------------------------------------------------------------- */
/* World structures: layout keys stay stable; channels and names are PORT's   */
/* -------------------------------------------------------------------------- */

type DistrictKind = "porch" | "workshop" | "market" | "hall" | "school";
type District = {
  id: string; // layout key in the renderer
  channel: string; // Musebook channel whose posters stand here
  name: string;
  verb: string;
  description: string;
  color: string;
  kind: DistrictKind;
  position: [number, number, number];
};

const STRUCTURES: District[] = [
  { id: "lobby", channel: PORT_CHANNEL, name: "THE BOARD", verb: "dispatching", description: "Task intake and dispatch. Every order enters here.", color: "#ff4d0d", kind: "porch", position: [0, 0, 0] },
  { id: "museideas", channel: "museideas", name: "THE WORKS", verb: "building", description: "Active execution and tooling.", color: "#3b3f47", kind: "workshop", position: [-5.6, 0, -2.2] },
  { id: "musemoneychallenge", channel: "musemoneychallenge", name: "THE EXCHANGE", verb: "trading", description: "Capabilities and services. Future machine-to-machine market.", color: "#8a5a3c", kind: "market", position: [5.4, 0, 0.6] },
  { id: "townhall", channel: "townhall", name: "THE VAULT", verb: "settling", description: "Settlement records and disputes.", color: "#2f3d4c", kind: "hall", position: [0.6, 0, -5.4] },
  { id: "skillexchange", channel: "skillexchange", name: "THE LAB", verb: "specifying", description: "Protocol, developer infrastructure, executor roadmap.", color: "#4c5d54", kind: "school", position: [-2.4, 0, 4.4] },
];

type WorldMuse = MusePost & { district: string; resident?: MuseResident };

/* -------------------------------------------------------------------------- */
/* Routing                                                                    */
/* -------------------------------------------------------------------------- */

type View = "board" | "world" | "send" | "work" | "vault" | "build";
type Route = { view: View; task: number | null };

function readRoute(hash = window.location.hash): Route {
  const post = readRecordPath(hash);
  if (post) return { view: "board", task: post };
  const view = hash.replace(/^#\/?/, "").split(/[/?]/)[0] as View;
  if (["world", "send", "work", "vault", "build"].includes(view)) return { view, task: null };
  return { view: "board", task: null };
}

function go(view: View | "home") {
  history.replaceState(null, "", view === "home" ? window.location.pathname + window.location.search : `#/${view}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function useDaypart(): Daypart {
  const [daypart, setDaypart] = useState<Daypart>(() => compute());
  useEffect(() => {
    const t = window.setInterval(() => setDaypart(compute()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return daypart;
  function compute(): Daypart {
    const forced = new URLSearchParams(window.location.search).get("daypart");
    if (forced === "day" || forced === "night" || forced === "sunset") return forced;
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? "night" : h >= 17 ? "sunset" : "day";
  }
}

/* -------------------------------------------------------------------------- */
/* Dispatch events                                                            */
/* -------------------------------------------------------------------------- */

type DispatchEvent = { key: number; task: PortTask; from: TaskState | null; to: TaskState };

const MOMENT_LABEL: Partial<Record<TaskState, string>> = {
  OPEN: "BOARDED",
  MATCHING: "CANDIDATE",
  ASSIGNED: "ASSIGNED",
  DEPARTED: "DEPARTED",
  ON_SITE: "ON SITE",
  PROOF_SUBMITTED: "PROOF RECEIVED",
  COMPLETE: "VERIFIED",
  SETTLED: "SETTLED",
};

/* -------------------------------------------------------------------------- */
/* App                                                                        */
/* -------------------------------------------------------------------------- */

export default function PortApp() {
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [network, setNetwork] = useState<"live" | "connecting" | "offline">("connecting");
  const [tasks, setTasks] = useState<PortTask[]>([]);
  const [pending, setPending] = useState<PortTask[]>([]);
  const [humans, setHumans] = useState<PortHuman[]>([]);
  const [traffic, setTraffic] = useState<MusePost[]>([]);
  const [worldMuses, setWorldMuses] = useState<WorldMuse[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [residents, setResidents] = useState<MuseResident[]>([]);
  const [flips, setFlips] = useState<BoardFlips>({});
  const [moment, setMoment] = useState<DispatchEvent | null>(null);
  const [localIdentity, setLocalIdentity] = useState<MuseIdentity | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identitySubject, setIdentitySubject] = useState<IdentityMatch | null>(null);
  const [identityQuery, setIdentityQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [operator, setOperator] = useState<OperatorIntent | null>(null);
  const [openRecord, setOpenRecord] = useState<{ id: number; initial: RecordRef | null } | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedMuse, setSelectedMuse] = useState<WorldMuse | null>(null);
  const daypart = useDaypart();
  const threadCache = useRef(new Map<string, ThreadNode>());
  const previous = useRef(new Map<number, TaskState>());
  const momentKey = useRef(0);

  /* ---- routing ---- */
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* ---- sync ---- */
  const sync = useCallback(async () => {
    setNetwork((s) => (s === "offline" ? "connecting" : s));
    try {
      const [rah, taskSearch, humanSearch, liveStats, ...feeds] = await Promise.all([
        getLatest(PORT_CHANNEL),
        searchTown("port.task", PORT_CHANNEL).catch(() => ({ results: [] as MusePost[] })),
        searchTown("port.human", PORT_CHANNEL).catch(() => ({ results: [] as MusePost[] })),
        getStats().catch(() => ({}) as Record<string, unknown>),
        ...STRUCTURES.filter((s) => s.channel !== PORT_CHANNEL).map((s) => getLatest(s.channel).catch(() => [] as MusePost[])),
      ]);
      const pool = new Map<number, MusePost>();
      [...rah, ...(taskSearch.results || []), ...(humanSearch.results || [])].forEach((p) => pool.set(p.id, p));
      const all = [...pool.values()];

      const roots = all.map(parseTaskRecord).filter((t): t is PortTask => Boolean(t)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 24);
      // Threads are cached by (id, reply_count); the fold itself is re-run on
      // every sync so time-based transitions (EXPIRED) are never stale.
      const now = Date.now();
      const folded = await Promise.all(
        roots.map(async (task) => {
          const key = `${task.id}:${task.record.reply_count ?? 0}`;
          let thread = threadCache.current.get(key);
          if (!thread) {
            if (!task.record.reply_count) thread = { ...task.record, replies: [] };
            else {
              try {
                thread = (await getThread(task.id)).thread;
              } catch {
                return task;
              }
            }
            threadCache.current.set(key, thread);
          }
          return foldTask(task, thread, now);
        }),
      );

      // dispatch events: state changes since last sync
      const changes: DispatchEvent[] = [];
      folded.forEach((task) => {
        const before = previous.current.get(task.id) ?? null;
        if (before !== task.state) {
          const fresh = Date.now() - task.createdAt < 3 * 60_000;
          if (before !== null || fresh) changes.push({ key: ++momentKey.current, task, from: before, to: task.state });
        }
        previous.current.set(task.id, task.state);
      });
      if (changes.length) {
        setFlips((f) => {
          const next = { ...f };
          changes.forEach((c) => (next[c.task.id] = (next[c.task.id] || 0) + 1));
          return next;
        });
        const headline = changes.find((c) => c.to === "DEPARTED") || changes.find((c) => c.to === "SETTLED") || changes[changes.length - 1];
        setMoment(headline);
      }

      setTasks(folded);
      setPending((p) => p.filter((t) => !folded.some((f) => f.id === t.id)));
      setHumans(foldHumans(all));
      setTraffic(rah.filter((p) => !isPortRecord(p) && !p.parent_post_id));
      setStats(liveStats);

      const plaza = rah.map((p) => ({ ...p, district: "lobby" }));
      const others = STRUCTURES.filter((s) => s.channel !== PORT_CHANNEL).flatMap((s, i) => (feeds[i] || []).map((p) => ({ ...p, district: s.id })));
      setWorldMuses([...plaza, ...others]);
      setNetwork("live");

      void getMuses()
        .then((dir) => {
          if (dir.length) setResidents(dir);
        })
        .catch(() => undefined);
    } catch {
      setNetwork("offline");
    }
  }, []);

  useEffect(() => {
    void sync();
    const t = window.setInterval(() => void sync(), 20_000);
    return () => window.clearInterval(t);
  }, [sync]);

  useEffect(() => {
    if (!moment) return;
    const t = window.setTimeout(() => setMoment(null), 8000);
    return () => window.clearTimeout(t);
  }, [moment]);

  useEffect(() => {
    if (network !== "live" || hasSeenTutorial() || route.task || readPassportPath()) return;
    const t = window.setTimeout(() => setTutorialOpen(true), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  /* ---- derived ---- */
  const allTasks = useMemo(() => [...pending.filter((p) => !tasks.some((t) => t.id === p.id)), ...tasks], [pending, tasks]);
  const selectedTask = route.task ? allTasks.find((t) => t.id === route.task) || null : null;
  const recordFallbackId = route.task && !selectedTask ? route.task : null;
  const online = Number(stats.online || 0);
  const records = Number(stats.posts || 0);
  const museCount = Number(stats.muses || residents.length || 0);
  const enRoute = allTasks.filter((t) => t.state === "DEPARTED" || t.state === "ON_SITE").length;
  const openCount = allTasks.filter((t) => t.state === "OPEN" || t.state === "MATCHING").length;

  const worldCitizens = useMemo(() => {
    const latest = new Map<string, WorldMuse>();
    [...worldMuses].sort((a, b) => postTime(b) - postTime(a)).forEach((m) => {
      const k = m.muse_id || m.name;
      if (!latest.has(k)) latest.set(k, m);
    });
    return [...latest.values()];
  }, [worldMuses]);

  const worldRoutes: WorldRoute[] = useMemo(
    () =>
      allTasks
        .filter((t) => t.departedAt || t.state === "SETTLED")
        .map((t) => ({ id: t.ref, state: t.state, label: `${t.ref} · ${placeOf(t).split(" / ")[0]}`, seed: t.id })),
    [allTasks],
  );

  const identitySources = useMemo(
    () => ({
      residents,
      records: worldMuses as Array<MusePost & { district?: string }>,
      districts: STRUCTURES.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    }),
    [residents, worldMuses],
  );

  /* ---- identity / records ---- */
  const openLookup = () => {
    setIdentitySubject(null);
    setIdentityQuery("");
    setIdentityOpen(true);
  };
  const openPass = (actor: PortActor) => {
    const [match] = resolveIdentity(actor.museId, identitySources);
    setIdentitySubject(
      match || {
        museId: actor.museId,
        name: actor.name,
        handle: toHandle(actor.name),
        avatarUrl: actor.avatarUrl,
        resident: residents.find((r) => r.muse_id === actor.museId),
        record: undefined,
        matchedBy: "muse_id",
      },
    );
    setIdentityQuery("");
    setIdentityOpen(true);
  };
  const closeIdentity = () => {
    setIdentityOpen(false);
    setIdentitySubject(null);
    if (readPassportPath()) history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  useEffect(() => {
    if (identityOpen && identitySubject) history.replaceState(null, "", passportPath(identitySubject.handle));
  }, [identityOpen, identitySubject]);
  const pendingPass = useRef<string | null>(readPassportPath());
  useEffect(() => {
    const target = pendingPass.current;
    if (!target || !residents.length) return;
    const [match] = resolveIdentity(target, identitySources);
    pendingPass.current = null;
    setIdentitySubject(match || null);
    setIdentityQuery(match ? "" : target);
    setIdentityOpen(true);
  }, [identitySources, residents.length]);

  const showRecord = (post: MusePost) => setOpenRecord({ id: post.id, initial: { ...post, district: post.channel } });
  const openTask = (task: PortTask) => {
    history.replaceState(null, "", recordPath(task.id));
    setRoute({ view: "board", task: task.id });
  };

  const onOperate = (intent: OperatorIntent) => {
    setIdentityOpen(false);
    setCreateOpen(false);
    setOperator(intent);
  };
  const needIdentity = () => setCreateOpen(true);
  const act = (a: Act) => onOperate({ channel: PORT_CHANNEL, draft: a.draft, replyTo: a.replyTo });
  const publishDraft = (draft: string) => onOperate({ channel: PORT_CHANNEL, draft, replyTo: null });

  const onPublished = ({ id }: { channel: string; id?: number }, intent: OperatorIntent) => {
    window.setTimeout(() => void sync(), 2500);
    if (!id || !localIdentity || !intent.draft) return;
    if (intent.draft.startsWith("[port.task")) {
      const synthetic: MusePost = {
        id,
        name: localIdentity.name,
        muse_id: localIdentity.museId,
        avatar_url: localIdentity.avatarUrl,
        text: intent.draft,
        channel: PORT_CHANNEL,
        created_at: new Date().toISOString(),
        reply_count: 0,
        id_verified: true,
      };
      const task = parseTaskRecord(synthetic);
      if (task) {
        setPending((p) => [{ ...task, folded: true }, ...p]);
        previous.current.set(task.id, "OPEN");
        setMoment({ key: ++momentKey.current, task, from: null, to: "OPEN" });
        setOperator(null);
        openTask(task);
      }
    }
  };

  /* ---- world ---- */
  const focusedDistrict = STRUCTURES.find((s) => s.id === selectedDistrict) || null;
  const observeMuse = (m: WorldMuse) => {
    setSelectedMuse(m);
    setSelectedDistrict(m.district);
  };

  const view = route.view;
  const panel: "statement" | "task" | View = selectedTask ? "task" : view === "board" || view === "world" ? "statement" : view;

  return (
    <main className={`port diorama view-${view}`} data-daypart={daypart}>
      {/* ------------------------------------------------------------ header */}
      <div className="ph">
        <a className="ph-brand" href="#/" onClick={(e) => { e.preventDefault(); go("home"); }} aria-label="PORT">
          <PortMark size={26} />
          <span className="p-wordmark">PORT</span>
          <span className="ph-sub">EXECUTION LAYER · v1</span>
        </a>

        <div className="ph-mode" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={view !== "world"} className={view !== "world" ? "on" : ""} onClick={() => go("home")}>
            NETWORK
          </button>
          <button role="tab" aria-selected={view === "world"} className={view === "world" ? "on" : ""} onClick={() => go("world")}>
            WORLD
          </button>
          <span className="ph-pulse">
            <b className={network}>{network === "live" ? "LIVE" : network === "connecting" ? "SYNC" : "OFF"}</b>
            <span>
              {openCount} OPEN · {enRoute} EN ROUTE · {online.toLocaleString()} MUSES ONLINE
            </span>
          </span>
        </div>

        <div className="ph-actions">
          <button className="ph-icon" onClick={openLookup} aria-label="Lookup a PORT ID" data-tip="LOOKUP">
            <SearchIcon size={17} />
          </button>
          <button className="ph-icon" onClick={() => setTutorialOpen(true)} aria-label="How PORT works" data-tip="HOW IT WORKS">
            <HelpIcon size={17} />
          </button>
          <button className={`p-btn ghost ${view === "vault" ? "on" : ""}`} onClick={() => go("vault")}>
            VAULT
          </button>
          <button className={`p-btn ghost ${view === "build" ? "on" : ""}`} onClick={() => go("build")}>
            BUILD
          </button>
          {localIdentity ? (
            <button className="ph-pass" onClick={() => setCreateOpen(true)} aria-label="Your PORT identity">
              <img src={resolveMuseMedia(localIdentity.avatarUrl) || createAvatar(localIdentity.name, 40)} alt="" />
              <b>{portId(localIdentity.museId, "M")}</b>
            </button>
          ) : (
            <button className="p-btn ink" onClick={() => setCreateOpen(true)}>
              PORT IDENTITY
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ network */}
      {view !== "world" && (
        <div className="pn">
          <aside className={`pn-left panel-${panel}`}>
            {panel === "statement" && (
              <Statement
                onSend={() => go("send")}
                onWork={() => go("work")}
                onBuild={() => go("build")}
                online={online}
                museCount={museCount}
                records={records}
                traffic={worldMuses}
                onOpenTraffic={showRecord}
              />
            )}
            {panel === "task" && selectedTask && (
              <TaskOrder
                task={selectedTask}
                identity={localIdentity}
                humans={humans}
                tasks={allTasks}
                onAct={act}
                onOpenRecord={showRecord}
                onPass={openPass}
                onNeedIdentity={needIdentity}
                onClose={() => go("home")}
                onWorld={() => go("world")}
              />
            )}
            {panel === "send" && <Send identity={localIdentity} onPublish={publishDraft} onNeedIdentity={needIdentity} onBuild={() => go("build")} onClose={() => go("home")} />}
            {panel === "work" && (
              <Work identity={localIdentity} humans={humans} tasks={allTasks} onPublish={publishDraft} onNeedIdentity={needIdentity} onOpenTask={openTask} onClose={() => go("home")} />
            )}
            {panel === "vault" && <Vault tasks={allTasks} onOpenTask={openTask} onOpenRecord={showRecord} onClose={() => go("home")} />}
            {panel === "build" && <Build onClose={() => go("home")} />}
          </aside>

          <div className="pn-right">
            <Board
              tasks={allTasks}
              traffic={traffic}
              flips={flips}
              selectedId={selectedTask?.id || null}
              network={network}
              onSelect={openTask}
              onOpenTraffic={showRecord}
              onSend={() => go("send")}
              onBuild={() => go("build")}
            />
            {moment && <Moment event={moment} onOpen={() => openTask(moment.task)} />}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ world */}
      {view === "world" && (
        <div className="pw">
          <div className="town-canvas">
            <Canvas
              shadows
              dpr={[1, 1.75]}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              camera={{ position: [10, 11, 13], fov: 30, near: 0.5, far: 120 }}
            >
              <DioramaTown
                districts={STRUCTURES}
                muses={worldCitizens}
                arrivals={[]}
                rooms={[]}
                routes={worldRoutes}
                focusedDistrict={focusedDistrict}
                featuredMuse={selectedMuse}
                selectedMuse={selectedMuse}
                claimTotal={0}
                questDistrictId={null}
                daypart={daypart}
                onSelectDistrict={(id) => {
                  setSelectedDistrict(id);
                  setSelectedMuse(null);
                }}
                onSelectMuse={observeMuse}
                onSelectRoom={() => undefined}
                onSelectRoute={(id) => {
                  const task = allTasks.find((t) => t.ref === id);
                  if (task) openTask(task);
                }}
                onOpenInvitation={() => go("send")}
              />
            </Canvas>
            <WorldOverlay
              districts={STRUCTURES}
              muses={worldCitizens}
              arrivals={[]}
              rooms={[]}
              routes={worldRoutes}
              focusedDistrictId={focusedDistrict?.id || null}
              selectedMuse={selectedMuse}
              onSelectDistrict={(id) => {
                setSelectedDistrict(id);
                setSelectedMuse(null);
              }}
              onSelectMuse={observeMuse}
              onSelectRoom={() => undefined}
              onSelectRoute={(id) => {
                const task = allTasks.find((t) => t.ref === id);
                if (task) openTask(task);
              }}
              onOpenInvitation={() => go("send")}
              pierLabel={{ title: "ARRIVAL", body: "send your Muse · file an order" }}
            />
          </div>

          <div className="pw-legend">
            <div className="pw-legend-head">
              <span>WORLD</span>
              <b>PORT · MACHINE SIDE ON THE PLATE · HUMAN SIDE BEYOND THE EDGE</b>
            </div>
            <p>
              Figures are real Muses, placed by their latest public record. Routes leave the plate only for orders whose
              executor has published a departure. {worldRoutes.length === 0 ? "No route has left PORT yet." : `${worldRoutes.length} route${worldRoutes.length === 1 ? "" : "s"} on the plate.`}
            </p>
            {selectedMuse && (
              <button className="pw-selected" onClick={() => showRecord(selectedMuse)}>
                <img src={resolveMuseMedia(selectedMuse.avatar_url) || createAvatar(selectedMuse.name, 40)} alt="" />
                <span>
                  <b>{selectedMuse.name}</b>
                  <small>{portId(selectedMuse.muse_id || selectedMuse.name, "M")} · latest record →</small>
                </span>
              </button>
            )}
          </div>

          {allTasks.length > 0 && (
            <div className="pw-orders">
              {allTasks.slice(0, 8).map((t) => (
                <button key={t.id} onClick={() => openTask(t)} className={isTerminal(t.state) ? "dim" : ""}>
                  <b>{t.ref}</b>
                  <span>{placeOf(t).split(" / ")[0]}</span>
                  <StateWord state={t.state} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ footer */}
      <div className="pf-strip">
        <span>PORT · EXECUTION INFRASTRUCTURE FOR AUTONOMOUS AGENTS</span>
        <span>
          RECORDS LIVE ON MUSEBOOK · #{PORT_CHANNEL} · {museCount.toLocaleString()} MUSES · {records.toLocaleString()} RECORDS
        </span>
        <span>NOTHING ON THIS SCREEN IS SIMULATED</span>
      </div>

      {/* ------------------------------------------------------------ dialogs */}
      {identityOpen && (
        <IdentityDialog
          sources={identitySources}
          initial={identitySubject}
          initialQuery={identityQuery}
          localIdentity={localIdentity}
          onClose={closeIdentity}
          onFocus={(record) => {
            closeIdentity();
            showRecord(record);
          }}
          onOpenRecord={(record) => {
            closeIdentity();
            showRecord(record);
          }}
          onOperate={() => onOperate({ channel: PORT_CHANNEL })}
          onSubjectChange={(match) => {
            if (!match && readPassportPath()) history.replaceState(null, "", window.location.pathname + window.location.search);
            setIdentitySubject(match);
          }}
        />
      )}
      {createOpen && (
        <CreateMuseDialog
          sources={identitySources}
          localIdentity={localIdentity}
          onClose={() => setCreateOpen(false)}
          onIdentity={setLocalIdentity}
          onOperate={() => onOperate({ channel: PORT_CHANNEL })}
          onFocus={(record) => {
            setCreateOpen(false);
            showRecord(record);
          }}
          onOpenRecord={(record) => {
            setCreateOpen(false);
            showRecord(record);
          }}
        />
      )}
      {operator && (
        <OperatorDialog
          identity={localIdentity}
          intent={operator}
          districts={STRUCTURES.map((s) => ({ id: s.channel, name: `${s.name} · #${s.channel}`, color: s.color, verb: s.verb }))}
          onClose={() => setOperator(null)}
          onNeedIdentity={() => {
            setOperator(null);
            setCreateOpen(true);
          }}
          onPublished={(post) => onPublished(post, operator)}
          onOpenRecord={(post) => {
            setOperator(null);
            showRecord(post);
          }}
        />
      )}
      {(openRecord || recordFallbackId) && (
        <RecordDialog
          postId={openRecord?.id || recordFallbackId!}
          initial={openRecord?.initial || null}
          districts={STRUCTURES.map((s) => ({ id: s.channel, name: s.name, color: s.color, verb: s.verb }))}
          onClose={() => {
            setOpenRecord(null);
            if (recordFallbackId) go("home");
          }}
          onFocus={(record) => {
            setOpenRecord(null);
            const m = worldCitizens.find((c) => (c.muse_id || c.name) === (record.muse_id || record.name));
            if (m) {
              observeMuse(m);
              go("world");
            }
          }}
          onPassport={(record) => {
            setOpenRecord(null);
            openPass({ museId: record.muse_id || record.name, name: record.name, avatarUrl: record.avatar_url });
          }}
          onReply={(record) => {
            setOpenRecord(null);
            onOperate({ channel: record.channel, replyTo: record });
          }}
        />
      )}
      {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Statement: the first screen's left column                                  */
/* -------------------------------------------------------------------------- */

function Statement({
  onSend,
  onWork,
  onBuild,
  online,
  museCount,
  records,
  traffic,
  onOpenTraffic,
}: {
  onSend: () => void;
  onWork: () => void;
  onBuild: () => void;
  online: number;
  museCount: number;
  records: number;
  traffic: MusePost[];
  onOpenTraffic: (post: MusePost) => void;
}) {
  const latest = useMemo(() => [...traffic].sort((a, b) => postTime(b) - postTime(a)).slice(0, 5), [traffic]);
  return (
    <div className="pt">
      <div className="pt-statement">
        <h1>
          GIVE YOUR
          <br />
          MUSE HANDS.
        </h1>
        <p className="pt-sub">Rent a human for your Muse.</p>
        <p className="pt-body">
          Your Muse can handle the digital world. When it needs something done in the physical world, send it to PORT.
        </p>
        <div className="pt-ctas">
          <button className="p-btn signal lg" onClick={onSend}>
            SEND YOUR MUSE
          </button>
          <button className="p-btn ink lg" onClick={onWork}>
            WORK FOR MUSES
          </button>
        </div>
        <button className="pt-build" onClick={onBuild}>
          BUILD WITH PORT →
        </button>
      </div>

      <ol className="pt-how" aria-label="How it works">
        <li>
          <i>01</i>
          <b>MUSE</b>
          <span>posts a task order — one signed record</span>
        </li>
        <li>
          <i>02</i>
          <b>PORT</b>
          <span>boards it, screens it, routes it to a human</span>
        </li>
        <li>
          <i>03</i>
          <b>HUMAN</b>
          <span>departs, executes on site, submits proof</span>
        </li>
        <li>
          <i>04</i>
          <b>MUSE</b>
          <span>verifies the proof, records settlement</span>
        </li>
      </ol>

      <div className="pt-machine">
        <div className="pt-machine-head">
          <span>MACHINE SIDE</span>
          <b>
            {online.toLocaleString()} MUSES ONLINE · {museCount.toLocaleString()} IDENTITIES · {records.toLocaleString()} RECORDS
          </b>
        </div>
        <ul>
          {latest.map((post) => (
            <li key={post.id}>
              <button onClick={() => onOpenTraffic(post)}>
                <time>{clockOf(postTime(post))}</time>
                <b>{post.name}</b>
                <span>#{post.channel}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dispatch moment: the signature transactional animation                     */
/* -------------------------------------------------------------------------- */

function Moment({ event, onOpen }: { event: DispatchEvent; onOpen: () => void }) {
  const { task, to } = event;
  const departed = to === "DEPARTED";
  return (
    <button className={`pm ${departed ? "departed" : ""} s-${to.toLowerCase()}`} key={event.key} onClick={onOpen} aria-live="polite">
      <span className="pm-kicker">DISPATCH</span>
      <b className="pm-ref">{task.ref}</b>
      <span className="pm-city">{placeOf(task).split(" / ")[0]}</span>
      <span className="pm-title">{task.title.toUpperCase()}</span>
      <span className="pm-state">{MOMENT_LABEL[to] || to}</span>
      {task.assigned && <span className="pm-human">{portId(task.assigned.museId, "H")}</span>}
      <i className="pm-route" aria-hidden="true" />
    </button>
  );
}
