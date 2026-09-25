import { ArrowLeft, ArrowRight, Award, BriefcaseBusiness, Network, Sparkles } from "lucide-react";
import { normalizePortTask } from "../../lib/execution";
import { museReputation, type PortContribution, type PortMuse, type PortReward, type PortTask } from "../../lib/port";
import TaskCard from "../components/TaskCard";
import { Link } from "../router";

export default function PublicMusePage({
  id,
  muses,
  tasks,
  contributions,
  rewards,
}: {
  id: string;
  muses: PortMuse[];
  tasks: PortTask[];
  contributions: PortContribution[];
  rewards: PortReward[];
}) {
  const muse = muses.find(
    (candidate) =>
      candidate.actor.museId.toLowerCase() === id.toLowerCase() ||
      candidate.ref.toLowerCase() === id.toLowerCase(),
  );

  if (!muse) {
    return (
      <main className="en-page">
        <section className="en-not-found en-shell">
          <span className="en-eyebrow">Public Muse profile</span>
          <h1>No signed profile found.</h1>
          <Link href="/muses" className="en-button en-button--dark"><ArrowLeft /> First 100 Muses</Link>
        </section>
      </main>
    );
  }

  const work = tasks.filter(
    (task) => task.creator.museId === muse.actor.museId || task.assigned?.museId === muse.actor.museId,
  );
  const reputation = museReputation(muse.actor.museId, tasks);
  const shipped = contributions.filter((item) => item.actor.museId === muse.actor.museId);
  const awards = rewards.filter((item) => item.recipientId === muse.actor.museId);
  const referrals = muses.filter((candidate) => candidate.referrerId === muse.actor.museId);

  return (
    <main className="en-page ms-public-muse">
      <section className="ms-public-muse__hero">
        <div className="ms-shell">
          <Link href="/muses" className="en-back-link"><ArrowLeft /> First 100</Link>
          <div className="ms-public-muse__identity">
            <div className="fm-avatar">{muse.actor.avatarUrl ? <img src={muse.actor.avatarUrl} alt="" /> : muse.actor.name.slice(0, 1)}</div>
            <div>
              <span className="ms-eyebrow fm-eyebrow"><b>{muse.ref}</b> Signed public profile</span>
              <h1>{muse.actor.name}</h1>
              <p>{muse.intent}</p>
            </div>
          </div>
          <dl>
            <div><dt>Completed</dt><dd>{reputation.tasksSettled}</dd></div>
            <div><dt>Created</dt><dd>{reputation.tasksCreated}</dd></div>
            <div><dt>Proof shipped</dt><dd>{shipped.length}</dd></div>
            <div><dt>Referrals</dt><dd>{referrals.length}</dd></div>
          </dl>
        </div>
      </section>

      <section className="ms-shell ms-public-muse__body">
        <div>
          <section>
            <header><span className="ms-eyebrow"><BriefcaseBusiness /> Signed work</span><h2>Mission history.</h2></header>
            <div className="en-task-grid">
              {work.map((task) => <TaskCard compact execution={normalizePortTask(task)} key={task.ref} />)}
            </div>
            {!work.length && <p className="en-panel-empty">No signed execution references this Muse yet.</p>}
          </section>
          <section>
            <header><span className="ms-eyebrow"><Sparkles /> Public artifacts</span><h2>Proof and contributions.</h2></header>
            <div className="ms-public-muse__proof">
              {shipped.map((item) => (
                <a href={item.proofUrl} target="_blank" rel="noreferrer" key={item.ref}>
                  <code>{item.ref}</code><span><strong>{item.title}</strong><small>{item.kind.toLowerCase()}</small></span><ArrowRight />
                </a>
              ))}
              {!shipped.length && <p className="en-panel-empty">No public contribution claims yet.</p>}
            </div>
          </section>
        </div>
        <aside>
          <section>
            <Network />
            <span><small>Qualified network growth</small><strong>{referrals.length} referred Muses</strong></span>
          </section>
          <section>
            <Award />
            <span><small>Verified awards</small><strong>{awards.length}</strong></span>
          </section>
          <div>
            <small>Specialties</small>
            <p>{muse.specialties.join(" · ") || "No specialties declared"}</p>
          </div>
          {muse.xHandle && <a href={`https://x.com/${muse.xHandle}`} target="_blank" rel="noreferrer">@{muse.xHandle} <ArrowRight /></a>}
        </aside>
      </section>
    </main>
  );
}
