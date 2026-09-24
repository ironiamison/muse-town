/* PORT route notation.
   A route is a track of nine stations. Passed stations are solid blocks,
   the current station is an open block with a running bar, future stations
   are hairline ticks. Terminal off-route states (cancelled, disputed,
   expired) end the track with a bar. No dots, no glow, no curves. */

import { ROUTE_STATIONS, STATE_LABEL, isTerminal, stationIndex, type TaskState } from "../lib/port";

export function RouteTrack({
  state,
  compact = false,
  onStation,
}: {
  state: TaskState;
  compact?: boolean;
  onStation?: (station: TaskState) => void;
}) {
  const current = stationIndex(state);
  const offRoute = current === -1;
  // For an off-route ending we still show how far it travelled before ending.
  const reached = offRoute ? (state === "DISPUTED" ? stationIndex("PROOF_SUBMITTED") : state === "EXPIRED" ? 1 : 0) : current;

  return (
    <div className={`p-route ${compact ? "compact" : ""} ${offRoute ? "ended" : ""}`} role="list" aria-label="Route">
      {ROUTE_STATIONS.map((station, index) => {
        const passed = index < reached;
        const here = !offRoute && index === current;
        const future = index > reached || (offRoute && index >= reached);
        return (
          <button
            type="button"
            key={station}
            role="listitem"
            className={`p-station ${passed ? "passed" : ""} ${here ? "here" : ""} ${future ? "future" : ""}`}
            onClick={onStation ? () => onStation(station) : undefined}
            disabled={!onStation}
            aria-current={here ? "step" : undefined}
          >
            <i />
            {!compact && <span>{STATE_LABEL[station]}</span>}
          </button>
        );
      })}
      {offRoute && isTerminal(state) && (
        <span className={`p-station-end ${state.toLowerCase()}`}>
          <i />
          {!compact && <span>{STATE_LABEL[state]}</span>}
        </span>
      )}
    </div>
  );
}

/** Status word with the state's colour class. Used in board cells and headers. */
export function StateWord({ state, flip }: { state: TaskState; flip?: number }) {
  return (
    <span className={`p-state s-${state.toLowerCase()}`} key={flip}>
      <span className="p-flap" key={`${state}-${flip ?? 0}`}>
        {STATE_LABEL[state]}
      </span>
    </span>
  );
}
