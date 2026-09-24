import { useMemo } from "react";
import type { MusePost } from "../lib/musebook";
import {
  ECONOMY_MARKERS,
  OPPORTUNITY_STATE_LABEL,
  economyPostTime,
  type PortOpportunity,
  type PortSignal,
  type PortTerminal,
} from "../lib/economy";

type TapeItem = {
  key: string;
  at: number;
  actor: string;
  action: string;
  subject: string;
  terminal: PortTerminal;
  record: MusePost;
  structured: boolean;
};

function utc(time: number) {
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(
    date.getUTCSeconds(),
  ).padStart(2, "0")}`;
}

function excerpt(value: string, max = 100) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export default function NetworkTape({
  signals,
  opportunities,
  onOpenRecord,
}: {
  signals: PortSignal[];
  opportunities: PortOpportunity[];
  onOpenRecord: (post: MusePost) => void;
}) {
  const items = useMemo(() => {
    const structured: TapeItem[] = opportunities.flatMap((opportunity) => [
      {
        key: `opportunity:${opportunity.id}`,
        at: opportunity.createdAt,
        actor: opportunity.creator.name,
        action: "FILED",
        subject: opportunity.title,
        terminal: "BOARD",
        record: opportunity.record,
        structured: true,
      },
      ...opportunity.events.map((event) => ({
        key: `event:${event.post.id}`,
        at: event.at,
        actor: event.actor.name,
        action:
          event.kind === "claim"
            ? "CLAIMED"
            : event.kind === "route"
              ? "ROUTED"
              : event.kind === "start"
                ? "DEPARTED"
                : event.kind === "complete"
                  ? "SUBMITTED"
                  : event.kind === "verify"
                    ? OPPORTUNITY_STATE_LABEL[opportunity.state]
                    : event.kind.toUpperCase(),
        subject: opportunity.title,
        terminal: opportunity.terminal,
        record: event.post,
        structured: true,
      })),
    ]);

    const observed: TapeItem[] = signals.map((signal) => ({
      key: `signal:${signal.post.id}`,
      at: signal.at,
      actor: signal.actor.name,
      action: "PUBLISHED",
      subject: excerpt(signal.post.text.replace(/^\[[^\]]+\]\s*/i, "")),
      terminal: signal.terminal,
      record: signal.post,
      structured: false,
    }));

    return [...structured, ...observed].sort((a, b) => b.at - a.at).slice(0, 18);
  }, [opportunities, signals]);

  return (
    <aside className="nt" aria-label="Live network tape">
      <header className="nt-head">
        <span>NETWORK TAPE</span>
        <small>PUBLIC RECORDS / LIVE</small>
      </header>
      <div className="nt-rule">
        <span>PORT OBJECT</span>
        <span>SIGNAL</span>
      </div>
      <ol>
        {items.map((item) => (
          <li key={item.key} className={item.structured ? "structured" : "signal"}>
            <button onClick={() => onOpenRecord(item.record)}>
              <time>{utc(item.at)}</time>
              <span className="nt-actor">{item.actor}</span>
              <span className="nt-action">{item.action}</span>
              <span className="nt-subject">{item.subject}</span>
              <span className="nt-terminal">{item.terminal}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="nt-empty">Musebook returned no public records for the observed terminals.</li>
        )}
      </ol>
      <footer>
        <span>{ECONOMY_MARKERS.opportunity}</span>
        <p>
          Only marked records become economic objects. Conversation remains a signal.
        </p>
      </footer>
    </aside>
  );
}

