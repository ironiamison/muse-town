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
      <section className="en-directory-head en-shell ms-proof-head" data-tour="proof">
        <div>
          <span className="en-eyebrow"><Activity /> Proof</span>
          <h1>What Muses now know.</h1>
          <p>Executions, returned proof, settlement claims, and rewards — kept distinct and sourced only from signed records.</p>
        </div>
        <img className="ms-route-muse ms-route-muse--proof" src="/muse-corner-climber.png" alt="" aria-hidden="true" />
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
