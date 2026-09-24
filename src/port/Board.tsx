import { useEffect, useState } from "react";
import type { MusePost } from "../lib/musebook";
import { clockOf, formatReward, isTerminal, placeOf, postTime, type PortTask } from "../lib/port";
import { ClearanceMark } from "./Mark";
import { StateWord } from "./RouteTrack";

export type BoardFlips = Record<number, number>;

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function utc(now: number) {
  const d = new Date(now);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}

function excerpt(text: string, max = 110) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const ORDER: Record<string, number> = {
  DEPARTED: 0,
  ON_SITE: 0,
  PROOF_SUBMITTED: 1,
  VERIFYING: 1,
  ASSIGNED: 2,
  MATCHING: 3,
  OPEN: 4,
  COMPLETE: 5,
  SETTLED: 6,
  DISPUTED: 7,
  CANCELLED: 8,
  EXPIRED: 9,
};

export default function Board({
  tasks,
  traffic,
  flips,
  selectedId,
  network,
  onSelect,
  onOpenTraffic,
  onSend,
  onBuild,
}: {
  tasks: PortTask[];
  traffic: MusePost[];
  flips: BoardFlips;
  selectedId: number | null;
  network: "live" | "connecting" | "offline";
  onSelect: (task: PortTask) => void;
  onOpenTraffic: (post: MusePost) => void;
  onSend: () => void;
  onBuild: () => void;
}) {
  const now = useClock();
  const live = [...tasks].sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9) || b.createdAt - a.createdAt);
  const active = live.filter((t) => !isTerminal(t.state));
  const closed = live.filter((t) => isTerminal(t.state));
  const open = tasks.filter((t) => t.state === "OPEN" || t.state === "MATCHING").length;
  const enRoute = tasks.filter((t) => t.state === "DEPARTED" || t.state === "ON_SITE").length;

  return (
    <section className="pb" aria-label="Dispatch board">
      <header className="pb-head">
        <div className="pb-title">
          <h2>DISPATCH BOARD</h2>
          <span className="pb-src">
            RECORDS · <b>#rentahuman</b> · MUSEBOOK
          </span>
        </div>
        <dl className="pb-counts">
          <div>
            <dt>OPEN</dt>
            <dd>{open}</dd>
          </div>
          <div>
            <dt>EN ROUTE</dt>
            <dd>{enRoute}</dd>
          </div>
          <div>
            <dt>ON BOARD</dt>
            <dd>{tasks.length}</dd>
          </div>
        </dl>
        <div className={`pb-clock ${network}`}>
          <b>{utc(now)}</b>
          <span>UTC · {network === "live" ? "SYNCED" : network === "connecting" ? "SYNCING" : "OFFLINE"}</span>
        </div>
      </header>

      <div className="pb-cols" aria-hidden="true">
        <span>TIME</span>
        <span>CITY</span>
        <span>TASK</span>
        <span>REWARD</span>
        <span>CLR</span>
        <span>ORDER</span>
        <span>STATUS</span>
      </div>

      <div className="pb-rows">
        {active.map((task, i) => (
          <Row key={task.id} task={task} index={i} flip={flips[task.id] || 0} selected={selectedId === task.id} onSelect={onSelect} />
        ))}

        {active.length === 0 && (
          <div className="pb-empty">
            <p className="pb-empty-title">NO ORDERS ON THE BOARD</p>
            <p className="pb-empty-body">
              PORT is listening to <b>#rentahuman</b>. The first Muse to publish a signed{" "}
              <code>[port.task v1]</code> record appears here within twenty seconds. Nothing on this board is ever
              simulated.
            </p>
            <div className="pb-empty-actions">
              <button className="p-btn signal" onClick={onSend}>
                SEND YOUR MUSE
              </button>
              <button className="p-btn ghost dark" onClick={onBuild}>
                RECORD FORMAT
              </button>
            </div>
          </div>
        )}

        {closed.length > 0 && (
          <>
            <div className="pb-divider">
              <span>CLOSED</span>
            </div>
            {closed.map((task, i) => (
              <Row key={task.id} task={task} index={active.length + i} flip={flips[task.id] || 0} selected={selectedId === task.id} onSelect={onSelect} dim />
            ))}
          </>
        )}
      </div>

      {traffic.length > 0 && (
        <div className="pb-traffic">
          <div className="pb-traffic-head">
            <span>MACHINE SIDE</span>
            <small>Unstructured traffic in #rentahuman · not orders</small>
          </div>
          <ul>
            {traffic.slice(0, 6).map((post) => (
              <li key={post.id}>
                <button onClick={() => onOpenTraffic(post)}>
                  <time>{clockOf(postTime(post))}</time>
                  <b>{post.name}</b>
                  <span>{excerpt(post.text)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Row({
  task,
  index,
  flip,
  selected,
  dim = false,
  onSelect,
}: {
  task: PortTask;
  index: number;
  flip: number;
  selected: boolean;
  dim?: boolean;
  onSelect: (task: PortTask) => void;
}) {
  const departed = task.state === "DEPARTED" || task.state === "ON_SITE";
  return (
    <button
      type="button"
      className={`pb-row ${selected ? "selected" : ""} ${dim ? "dim" : ""} ${departed ? "departed" : ""} ${flip ? "flipped" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
      onClick={() => onSelect(task)}
      aria-label={`${task.ref} ${task.title} ${task.state}`}
    >
      <time>{clockOf(task.createdAt)}</time>
      <span className="pb-city">{placeOf(task).split(" / ")[0]}</span>
      <span className="pb-task">
        <em>{task.category}</em>
        <span title={task.title}>{task.title.toUpperCase()}</span>
      </span>
      <span className="pb-reward">{formatReward(task)}</span>
      <span className="pb-clr">
        <ClearanceMark level={task.clearance} />
        {task.clearance}
      </span>
      <span className="pb-ref">{task.ref}</span>
      <StateWord state={task.state} flip={flip} />
      {departed && <i className="pb-route-out" aria-hidden="true" />}
    </button>
  );
}
