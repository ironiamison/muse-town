import {
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Timer,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { PortTask } from "../../lib/port";
import { screenTask } from "../../lib/port";
import type { Execution } from "../../lib/execution";
import {
  formatExecutionReward,
  locationLabel,
} from "../../lib/execution";
import ExecutionFlow from "../components/ExecutionFlow";
import NetworkAvatar from "../components/NetworkAvatar";
import ProofCapsuleView from "../components/ProofCapsuleView";
import ProofViewer from "../components/ProofViewer";
import StatusIndicator from "../components/StatusIndicator";
import { Link } from "../router";

function formatDate(value: number | null) {
  if (!value) return "No deadline published";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default function ExecutionPage({
  execution,
  task,
  identity,
  onManage,
}: {
  execution: Execution;
  task: PortTask | null;
  identity: MuseIdentity | null;
  onManage: (task: PortTask) => void;
}) {
  const [copied, setCopied] = useState(false);
  const safety = screenTask(`${execution.title}\n${execution.instructions}`);
  const mine = identity?.museId;
  const creator = mine === execution.requester.id;
  const assigned = mine === execution.executor?.id;
  const actionLabel = creator
    ? "Manage request"
    : assigned
      ? "Continue active task"
      : ["CREATED", "MATCHING"].includes(execution.status)
        ? "Claim this task"
        : "View signed history";

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: execution.title, text: `${execution.id} · ${execution.status}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="en-page">
      <section className="en-execution-detail-head">
        <div className="en-shell">
          <Link href="/tasks" className="en-back-link"><ArrowLeft /> Back to tasks</Link>
          <div className="en-execution-detail-head__meta">
            <StatusIndicator status={execution.status} />
            <span>{execution.id}</span>
            <button onClick={() => void share()}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Share"}</button>
          </div>
          <h1>{execution.title}</h1>
          <p>{execution.instructions}</p>
          <div className="en-execution-detail-head__facts">
            <span><MapPin /> {locationLabel(execution.location)}</span>
            <span><Timer /> {task?.duration || execution.capability.estimatedDuration}</span>
            <strong>{formatExecutionReward(execution)}</strong>
          </div>
        </div>
      </section>

      <section className="en-execution-detail en-shell">
        <div className="en-execution-detail__main">
          <ExecutionFlow execution={execution} emphasis />
          <section className="en-task-brief">
            <header><span>Task brief</span><code>{execution.capability.id}</code></header>
            <p>{execution.instructions}</p>
            <dl>
              <div><dt><MapPin /> Where</dt><dd>{locationLabel(execution.location)}</dd></div>
              <div><dt><CalendarClock /> Deadline</dt><dd>{formatDate(execution.deadline)}</dd></div>
              <div><dt><Timer /> Estimated time</dt><dd>{task?.duration || "Not specified by requester"}</dd></div>
              <div><dt><ShieldCheck /> Required history</dt><dd>{task?.clearance || "Provider-defined"}</dd></div>
            </dl>
          </section>
          <section className="en-task-proof">
            <header>
              <div>
                <span className="en-eyebrow">Proof of execution</span>
                <h2>{execution.proof.length ? "Returned evidence" : "What must come back"}</h2>
              </div>
            </header>
            {execution.proof.length ? (
              <>
                <ProofViewer proof={execution.proof} />
                <ProofCapsuleView execution={execution} task={task} />
              </>
            ) : (
              <ol className="en-proof-requirements">
                {execution.proofRequirements.map((proof, index) => (
                  <li key={`${proof.type}-${index}`}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <span><strong>{String(proof.type).toLowerCase()}</strong><p>{proof.description}</p></span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {execution.status === "COMPLETE" && (
            <section className="en-result-card">
              <span>Execution complete</span>
              <h2>{execution.requester.name} → {execution.executor?.name ?? execution.executorType}</h2>
              <p>“{execution.title}”</p>
              <div><Check /> Result returned · {execution.completedAt ? formatDate(execution.completedAt) : "verified"}</div>
              <strong>{formatExecutionReward(execution)}</strong>
            </section>
          )}
        </div>
        <aside className="en-execution-sidebar">
          <section>
            <small>Requested by</small>
            <div className="en-party-card">
              <NetworkAvatar
                name={execution.requester.name}
                image={execution.requester.avatarUrl}
                type={execution.requester.type}
                size="large"
              />
              <span><strong>{execution.requester.name}</strong><em>{execution.requester.type}</em></span>
            </div>
          </section>
          {execution.executor && (
            <section>
              <small>Executor</small>
              <div className="en-party-card">
                <NetworkAvatar
                  name={execution.executor.name}
                  image={execution.executor.avatarUrl}
                  type={execution.executor.type}
                  size="large"
                />
                <span><strong>{execution.executor.name}</strong><em>{execution.executor.type}</em></span>
              </div>
            </section>
          )}
          <section className="en-safety-card">
            <ShieldCheck />
            <div>
              <strong>{safety.ok ? "Automated safety screen passed" : "Review safety warning"}</strong>
              <p>{safety.ok ? "Read the full brief and use your judgment before accepting." : safety.reason}</p>
            </div>
          </section>
          {task && (
            <button className="en-button en-button--primary en-button--wide" onClick={() => onManage(task)}>
              {actionLabel}
            </button>
          )}
          <section className="en-payment-truth">
            <WalletCards />
            <div>
              <strong>{execution.payment.status === "DECLARED_PAID" ? "Payment recorded" : "Direct payment"}</strong>
              <p>
                {execution.payment.status === "DECLARED_PAID"
                  ? `${execution.payment.amount ?? "—"} ${execution.payment.currency} · creator-signed external claim`
                  : "The network does not custody funds or promise settlement."}
              </p>
            </div>
          </section>
          <details className="en-advanced">
            <summary>Advanced record details</summary>
            <dl>
              <div><dt>Protocol</dt><dd>{execution.source}</dd></div>
              <div><dt>Source state</dt><dd>{execution.sourceStatus}</dd></div>
              <div><dt>Fold complete</dt><dd>{execution.folded ? "yes" : "partial"}</dd></div>
              <div><dt>Payment finality</dt><dd>not verified</dd></div>
            </dl>
            <a href={execution.publicRecordUrl} target="_blank" rel="noreferrer">
              Open signed source <ExternalLink />
            </a>
          </details>
        </aside>
      </section>
    </main>
  );
}
