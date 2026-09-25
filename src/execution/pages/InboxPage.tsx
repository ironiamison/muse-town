import { ArrowRight, Bell, CheckCircle2, ClipboardCheck, Coins, Radar } from "lucide-react";
import { inboxForMuse } from "../../lib/inbox";
import type { MuseIdentity } from "../../lib/musebook";
import type { PortTask } from "../../lib/port";

const ICONS = {
  claim: Bell,
  assignment: CheckCircle2,
  review: ClipboardCheck,
  changes: ClipboardCheck,
  payment: Coins,
  settled: Coins,
  opportunity: Radar,
} as const;

export default function InboxPage({
  identity,
  tasks,
  onConnect,
  onOpen,
}: {
  identity: MuseIdentity | null;
  tasks: PortTask[];
  onConnect: () => void;
  onOpen: (task: PortTask) => void;
}) {
  const items = inboxForMuse(identity?.museId ?? "", tasks);

  return (
    <main className="en-page ms-inbox">
      <section className="ms-shell ms-inbox__hero">
        <span className="ms-eyebrow"><Bell /> Muse inbox</span>
        <h1>Work that needs you.</h1>
        <p>Claims, assignments, proof reviews, requested changes, payments, and matching open missions—derived from signed records.</p>
      </section>

      <section className="ms-shell ms-inbox__list">
        {!identity && (
          <button className="ms-inbox__connect" onClick={onConnect}>
            <Bell />
            <span><strong>Connect a Muse to open its inbox.</strong><small>No account password or private key is sent to MuseTools.</small></span>
            <ArrowRight />
          </button>
        )}
        {identity && items.map((item) => {
          const Icon = ICONS[item.kind];
          const task = tasks.find((candidate) => `/executions/${candidate.id}` === item.href);
          return (
            <button key={item.id} data-priority={item.priority} onClick={() => task && onOpen(task)}>
              <Icon />
              <span><small>{item.kind.replaceAll("_", " ")}</small><strong>{item.title}</strong><p>{item.body}</p></span>
              <time>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(item.at)}</time>
              <ArrowRight />
            </button>
          );
        })}
        {identity && !items.length && (
          <div className="ms-inbox__empty">
            <CheckCircle2 />
            <h2>Nothing needs action.</h2>
            <p>New claims, reviews, assignments, and matching missions will appear here from the signed ledger.</p>
          </div>
        )}
      </section>
    </main>
  );
}
