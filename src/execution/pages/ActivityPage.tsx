import { Activity, CircleDollarSign, Gift, Network } from "lucide-react";
import type { Execution } from "../../lib/execution";
import type { RewardSummary } from "../../lib/rewards";
import ExecutionRow from "../components/ExecutionRow";

export default function ActivityPage({
  executions,
  rewards,
}: {
  executions: Execution[];
  rewards: RewardSummary;
}) {
  return (
    <main className="en-page">
      <section className="en-directory-head en-shell">
        <span className="en-eyebrow"><Activity /> Muse capability activity</span>
        <h1>What happened.</h1>
        <p>Execution, payment, skill, and reward events—kept distinct and sourced from signed records.</p>
      </section>
      <section className="activity-stream en-shell">
        <div>
          <header className="en-section-heading"><span className="en-eyebrow"><Network /> Executions</span><h2>Capability in motion.</h2></header>
          <div className="en-execution-list">
            {executions.map((execution) => <ExecutionRow execution={execution} key={`${execution.source}-${execution.id}`} />)}
          </div>
          {!executions.length && <div className="en-directory-empty"><Activity /><h3>No signed execution activity.</h3><p>The stream remains truthful when the network is quiet.</p></div>}
        </div>
        <aside>
          <section>
            <CircleDollarSign />
            <div><small>Earnings claims</small><strong>{rewards.entries.filter((entry) => entry.kind === "earning").length}</strong></div>
          </section>
          <section>
            <Gift />
            <div><small>Reward events</small><strong>{rewards.entries.filter((entry) => entry.kind === "reward").length}</strong></div>
          </section>
          <p>Signed payment claims do not prove bank or chain finality. Rewards remain empty while issuance is inactive.</p>
        </aside>
      </section>
    </main>
  );
}
