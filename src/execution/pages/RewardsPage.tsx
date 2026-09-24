import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Gift,
  Hand,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";
import type { RewardSummary } from "../../lib/rewards";
import { REWARD_POLICIES } from "../../lib/rewards";
import { Link } from "../router";

function amount(values: Array<{ currency: string; amount: number }>) {
  if (!values.length) return "—";
  return values
    .map(
      (value) =>
        `${value.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${value.currency}`,
    )
    .join(" + ");
}

export default function RewardsPage({
  identity,
  rewards,
}: {
  identity: MuseIdentity | null;
  rewards: RewardSummary;
}) {
  return (
    <main className="en-page rewards-page">
      <section className="rewards-hero">
        <div className="en-shell rewards-hero__layout">
          <div>
            <span className="en-eyebrow"><Gift /> Useful activity output</span>
            <h1>Put your Muse to work.</h1>
            <p>Rewards follow legitimate value. Not logins, streaks, account connections, or noise.</p>
            <Link href={identity ? "/activity" : "/profile"} className="en-button en-button--primary">
              {identity ? "View Muse activity" : "Connect your Muse"} <ArrowRight />
            </Link>
          </div>
          <div className="reward-machine">
            <div className="reward-machine__inputs">
              <span><Hand /><strong>Human execution</strong><small>Completed + verified</small></span>
              <span><Sparkles /><strong>Skill use</strong><small>Useful invocation</small></span>
              <span><Network /><strong>Network activity</strong><small>Legitimate routed value</small></span>
            </div>
            <i><b /></i>
            <div className="reward-machine__output">
              <Gift />
              <span><small>Reward output</small><strong>{rewards.rewardIssuanceActive ? amount(rewards.rewards) : "Issuance inactive"}</strong></span>
            </div>
          </div>
        </div>
      </section>

      <section className="reward-metrics en-shell">
        <header><span className="en-eyebrow">Current signed snapshot</span><small>Network activity, earnings, and rewards are separate ledgers.</small></header>
        <dl>
          <div><dt>Network volume</dt><dd>{amount(rewards.networkActivity.volume)}</dd><span>Completed signed activity</span></div>
          <div><dt>Executions</dt><dd>{rewards.networkActivity.executions}</dd><span>Verified human tasks</span></div>
          <div><dt>Humans hired</dt><dd>{rewards.networkActivity.humansHired}</dd><span>Unique assigned executors</span></div>
          <div><dt>Skills used</dt><dd>{rewards.networkActivity.skillsUsed}</dd><span>Signed service-use records</span></div>
          <div><dt>Earnings</dt><dd>{amount(rewards.earnings)}</dd><span>External payment claims</span></div>
          <div className="is-reward"><dt>Rewards</dt><dd>{rewards.rewardIssuanceActive ? amount(rewards.rewards) : "Not issued"}</dd><span>No active issuance policy</span></div>
        </dl>
      </section>

      <section className="reward-ledgers">
        <div className="en-shell">
          <header className="en-section-heading">
            <span className="en-eyebrow">Why value appeared</span>
            <h2>Every number should explain itself.</h2>
          </header>
          <div className="reward-ledgers__tabs">
            <article>
              <CircleDollarSign />
              <h3>Network activity</h3>
              <p>Volume and completed work moving through the system. This is not income.</p>
            </article>
            <article>
              <Check />
              <h3>Earnings</h3>
              <p>Signed external payment claims tied to completed work. Finality is not independently verified.</p>
            </article>
            <article>
              <Gift />
              <h3>Rewards</h3>
              <p>Policy-issued incentives for useful activity. No policy is currently issuing rewards.</p>
            </article>
          </div>
          <div className="reward-events">
            {rewards.entries.map((entry) => (
              <div key={entry.id}>
                <span className={`reward-event-icon is-${entry.kind}`}>{entry.kind === "reward" ? <Gift /> : entry.kind === "earning" ? <CircleDollarSign /> : <Network />}</span>
                <span><strong>{entry.label}</strong><small>{entry.sourceRef} · {entry.finality.replaceAll("_", " ")}</small></span>
                <em>{entry.amount === null ? "No amount" : `${entry.amount} ${entry.currency}`}</em>
              </div>
            ))}
            {!rewards.entries.length && (
              <div className="en-directory-empty">
                <Network />
                <h3>No completed signed activity loaded.</h3>
                <p>The ledger remains empty instead of inventing productive activity.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="reward-policy en-shell">
        <div>
          <span className="en-eyebrow"><ShieldCheck /> Configurable policy</span>
          <h2>No hardcoded financial promises.</h2>
          <p>Reward policies are modular. They can define eligible useful events, rates, currencies, and caps. Issuance must be explicitly activated.</p>
        </div>
        <div>
          {REWARD_POLICIES.map((policy) => (
            <article key={policy.id}>
              <header><code>{policy.id}</code><span className={policy.active ? "active" : ""}>{policy.active ? "active" : "inactive"}</span></header>
              <p>{policy.description}</p>
              <dl><div><dt>Rate</dt><dd>{policy.rate ?? "Not set"}</dd></div><div><dt>Currency</dt><dd>{policy.currency ?? "Not set"}</dd></div><div><dt>Cap</dt><dd>{policy.cap ?? "Not set"}</dd></div></dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
