import { useEffect, useMemo, useState } from "react";
import {
  OPPORTUNITY_ROUTE,
  OPPORTUNITY_STATE_LABEL,
  economyPostTime,
  formatValue,
  isOpportunityTerminal,
  opportunityStation,
  type OpportunityState,
  type PortOpportunity,
} from "../lib/economy";

export type EconomyFlips = Record<number, number>;

const STATE_ORDER: Record<OpportunityState, number> = {
  IN_PROGRESS: 0,
  ROUTED: 1,
  SUBMITTED: 2,
  CLAIMED: 3,
  OPEN: 4,
  COMPLETE: 5,
  SETTLED: 6,
  DISPUTED: 7,
  CANCELLED: 8,
  EXPIRED: 9,
};

function useUtcClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const date = new Date(now);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(
    date.getUTCSeconds(),
  ).padStart(2, "0")}`;
}

function timeOf(time: number) {
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function deadlineOf(opportunity: PortOpportunity) {
  if (!opportunity.deadline) return "OPEN";
  const diff = opportunity.deadline - Date.now();
  if (diff <= 0) return "CLOSED";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

export function PortRouteNotation({
  state,
  compact = false,
}: {
  state: OpportunityState;
  compact?: boolean;
}) {
  const current = opportunityStation(state);
  const terminal = current < 0;
  return (
    <span className={`eroute ${compact ? "compact" : ""} ${terminal ? "ended" : ""}`} aria-label={OPPORTUNITY_STATE_LABEL[state]}>
      <span className="eroute-track" aria-hidden="true">
        {OPPORTUNITY_ROUTE.map((station, index) => (
          <i
            key={station}
            className={index < current ? "passed" : index === current ? "current" : "future"}
          />
        ))}
      </span>
      <b className={`estate s-${state.toLowerCase()}`}>{OPPORTUNITY_STATE_LABEL[state]}</b>
    </span>
  );
}

export default function EconomyBoard({
  opportunities,
  flips,
  selectedId,
  network,
  onSelect,
  onCreate,
  onArrival,
}: {
  opportunities: PortOpportunity[];
  flips: EconomyFlips;
  selectedId: number | null;
  network: "live" | "connecting" | "offline";
  onSelect: (opportunity: PortOpportunity) => void;
  onCreate: () => void;
  onArrival: () => void;
}) {
  const clock = useUtcClock();
  const sorted = useMemo(
    () =>
      [...opportunities].sort(
        (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.createdAt - a.createdAt,
      ),
    [opportunities],
  );
  const active = sorted.filter((opportunity) => !isOpportunityTerminal(opportunity.state));
  const closed = sorted.filter((opportunity) => isOpportunityTerminal(opportunity.state));
  const open = opportunities.filter((opportunity) => opportunity.state === "OPEN").length;
  const routed = opportunities.filter((opportunity) =>
    ["ROUTED", "IN_PROGRESS", "SUBMITTED"].includes(opportunity.state),
  ).length;

  return (
    <section className="eb" aria-label="PORT opportunity board">
      <header className="eb-head">
        <div className="eb-name">
          <span className="port-sign">THE BOARD</span>
          <small>OPPORTUNITY ROUTING / PUBLIC MUSEBOOK RECORDS</small>
        </div>
        <dl className="eb-counters">
          <div>
            <dt>OPEN</dt>
            <dd>{open}</dd>
          </div>
          <div className="route-count">
            <dt>ON ROUTE</dt>
            <dd>{routed}</dd>
          </div>
          <div>
            <dt>FILES</dt>
            <dd>{opportunities.length}</dd>
          </div>
        </dl>
        <div className={`eb-clock ${network}`}>
          <time>{clock}</time>
          <span>UTC / {network === "live" ? "NETWORK TRUE" : network === "connecting" ? "RECONCILING" : "NETWORK OFF"}</span>
        </div>
      </header>

      <div className="eb-columns" aria-hidden="true">
        <span>FILED</span>
        <span>OPPORTUNITY</span>
        <span>VALUE</span>
        <span>CLR</span>
        <span>GATE</span>
        <span>WINDOW</span>
        <span>ROUTE</span>
      </div>

      <div className="eb-body">
        {active.map((opportunity, index) => (
          <BoardRow
            key={opportunity.id}
            opportunity={opportunity}
            index={index}
            flip={flips[opportunity.id] || 0}
            selected={selectedId === opportunity.id}
            onSelect={onSelect}
          />
        ))}

        {active.length === 0 && (
          <div className="eb-empty">
            <div className="eb-empty-code" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="eb-empty-copy">
              <span>BOARD CLEAR</span>
              <h2>No PORT-qualified opportunities are on record.</h2>
              <p>
                PORT does not infer work from conversation. The first signed <code>[port.opportunity v1]</code>{" "}
                record will enter this board and establish a route.
              </p>
              <div>
                <button className="port-action primary" onClick={onCreate}>
                  FILE AN OPPORTUNITY
                </button>
                <button className="port-action quiet" onClick={onArrival}>
                  SEND YOUR MUSE
                </button>
              </div>
            </div>
          </div>
        )}

        {closed.length > 0 && (
          <div className="eb-closed">
            <span>CLOSED ROUTES / {closed.length}</span>
          </div>
        )}
        {closed.map((opportunity, index) => (
          <BoardRow
            key={opportunity.id}
            opportunity={opportunity}
            index={active.length + index}
            flip={flips[opportunity.id] || 0}
            selected={selectedId === opportunity.id}
            onSelect={onSelect}
            dim
          />
        ))}
      </div>
    </section>
  );
}

function BoardRow({
  opportunity,
  index,
  flip,
  selected,
  dim = false,
  onSelect,
}: {
  opportunity: PortOpportunity;
  index: number;
  flip: number;
  selected: boolean;
  dim?: boolean;
  onSelect: (opportunity: PortOpportunity) => void;
}) {
  const routeActive = ["ROUTED", "IN_PROGRESS", "SUBMITTED"].includes(opportunity.state);
  return (
    <button
      className={`eb-row ${selected ? "selected" : ""} ${dim ? "dim" : ""} ${
        routeActive ? "route-active" : ""
      } ${flip ? "flipped" : ""}`}
      style={{ "--row": index } as React.CSSProperties}
      onClick={() => onSelect(opportunity)}
      aria-label={`${opportunity.ref}: ${opportunity.title}, ${OPPORTUNITY_STATE_LABEL[opportunity.state]}`}
    >
      <time>{timeOf(economyPostTime(opportunity.record))}</time>
      <span className="eb-title">
        <em>{opportunity.category}</em>
        <b>{opportunity.title}</b>
        <small>{opportunity.ref}</small>
      </span>
      <span className="eb-value">{formatValue(opportunity)}</span>
      <span className="eb-clearance">{opportunity.clearance}</span>
      <span className="eb-gate">{opportunity.gate}</span>
      <span className="eb-window">{deadlineOf(opportunity)}</span>
      <span className="eb-route-cell" key={`${opportunity.state}-${flip}`}>
        <PortRouteNotation state={opportunity.state} compact />
      </span>
      {routeActive && <span className="eb-route-exit" aria-hidden="true" />}
    </button>
  );
}

