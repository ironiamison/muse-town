import type { MusePost } from "../lib/musebook";
import { clockOf, formatReward, placeOf, portId, postTime, vaultTotals, type PortTask } from "../lib/port";

export default function Vault({ tasks, onOpenTask, onOpenRecord, onClose }: { tasks: PortTask[]; onOpenTask: (task: PortTask) => void; onOpenRecord: (post: MusePost) => void; onClose: () => void }) {
  const totals = vaultTotals(tasks);
  const settled = tasks.filter((t) => t.settlement).sort((a, b) => (b.settlement!.post.id || 0) - (a.settlement!.post.id || 0));

  return (
    <article className="pf pv" aria-label="The Vault">
      <header className="pf-head">
        <div className="po-kicker">
          <span>SETTLEMENT</span>
          <b>THE VAULT</b>
        </div>
        <button className="p-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <h1 className="pf-title">EVERY FIGURE HERE IS A PUBLIC RECORD.</h1>
      <p className="pf-lede">
        PORT does not hold funds. Rewards are declared in task orders; settlements are declared by the creating Muse with
        a rail and a transaction reference. The Vault reads those records and nothing else.
      </p>

      <dl className="pv-totals">
        <div>
          <dt>TASK VALUE ON BOARD</dt>
          <dd>
            {totals.routed.length ? (
              totals.routed.map((r) => (
                <span key={r.asset}>
                  {r.amount.toLocaleString()} <small>{r.asset}</small>
                </span>
              ))
            ) : (
              <span className="none">0</span>
            )}
          </dd>
        </div>
        <div>
          <dt>AWAITING VERIFICATION</dt>
          <dd>{totals.awaitingVerification}</dd>
        </div>
        <div>
          <dt>SETTLED</dt>
          <dd>{totals.settled}</dd>
        </div>
        <div>
          <dt>DISPUTED</dt>
          <dd>{totals.disputed}</dd>
        </div>
        <div className="reserve">
          <dt>META REWARD RESERVE</dt>
          <dd>
            <span className="none">NOT LIVE</span>
          </dd>
          <p>
            Ecosystem incentives are separate from task payment. No reserve exists yet, so no balance is shown. When one
            does, this cell reads from its public ledger.
          </p>
        </div>
      </dl>

      <section className="pf-open">
        <div className="pf-form-head">
          <h3>SETTLEMENT RECORDS · {settled.length}</h3>
          <small>Creator-declared. Each row links to the signed record and its reference.</small>
        </div>
        {settled.length ? (
          <ul className="pv-ledger">
            {settled.map((task) => (
              <li key={task.id}>
                <button className="pv-row" onClick={() => onOpenTask(task)}>
                  <b>{task.ref}</b>
                  <span className="pv-title">{task.title}</span>
                  <span className="pv-amt">{formatReward({ reward: task.settlement!.amount ?? task.reward, asset: task.settlement!.asset })}</span>
                  <time>{clockOf(postTime(task.settlement!.post))}</time>
                  <small>
                    {placeOf(task)} · {portId(task.creator.museId, "M")} → {task.assigned ? portId(task.assigned.museId, "H") : "—"}
                  </small>
                  <em>
                    {task.settlement!.rail ? task.settlement!.rail.toUpperCase() : "RECORD"}
                    {task.settlement!.tx ? ` · ${task.settlement!.tx.slice(0, 14)}` : ""}
                  </em>
                </button>
                <button className="p-btn ghost small" onClick={() => onOpenRecord(task.settlement!.post)}>
                  RECORD
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pf-none">NO SETTLEMENTS RECORDED. The first one appears here the moment a Muse publishes it.</p>
        )}
      </section>
    </article>
  );
}
