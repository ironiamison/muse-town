import {
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  Gift,
  Hand,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { WalletSession } from "../../lib/wallet";
import type { Execution } from "../../lib/execution";
import type { MuseSkill } from "../../lib/skills";
import type { RewardSummary } from "../../lib/rewards";
import { Link } from "../router";
import StatusIndicator from "./StatusIndicator";

export default function MuseStatus({
  identity,
  wallet,
  executions,
  skills,
  rewards,
  onConnect,
}: {
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  executions: Execution[];
  skills: MuseSkill[];
  rewards: RewardSummary;
  onConnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mine = useMemo(
    () =>
      identity
        ? executions.filter(
            (execution) =>
              execution.requester.id === identity.museId ||
              execution.executor?.id === identity.museId,
          )
        : [],
    [executions, identity],
  );
  const active = mine.filter((execution) =>
    ["CREATED", "MATCHING", "CLAIMED", "IN_PROGRESS", "PROOF_SUBMITTED", "VERIFYING"].includes(
      execution.status,
    ),
  );
  const liveSkills = skills.filter(
    (skill) => skill.availability === "live" && skill.provider?.id === identity?.museId,
  );
  const rewardAmount = rewards.rewards[0];

  return (
    <aside className={`muse-status ${open ? "is-open" : ""}`}>
      <button
        className="muse-status__summary"
        onClick={() => (identity ? setOpen((value) => !value) : onConnect())}
      >
        <span className="muse-status__avatar">
          {identity?.avatarUrl ? <img src={identity.avatarUrl} alt="" /> : <UserRound />}
          <i className={identity ? "is-live" : ""} />
        </span>
        <span>
          <small>{identity ? "Muse connected" : "Muse capability system"}</small>
          <strong>{identity?.name ?? "Connect your Muse"}</strong>
        </span>
        {identity ? <ChevronDown /> : <ArrowRight />}
      </button>
      {identity && (
        <div className="muse-status__quick">
          <span>{active.length} active</span>
          <span>{liveSkills.length} live skills</span>
          <span>{wallet ? "payment connected" : "no payment rail"}</span>
        </div>
      )}
      {open && identity && (
        <div className="muse-control">
          <header>
            <div>
              <small>Muse control surface</small>
              <h2>{identity.name}</h2>
              <span><i /> Active</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close Muse control surface">
              <X />
            </button>
          </header>
          <div className="muse-control__systems">
            <Link href="/humans"><Hand /><span><small>Humans</small><strong>{active.filter((item) => item.executorType === "human").length} active tasks</strong></span></Link>
            <Link href="/x402"><CircleDollarSign /><span><small>x402</small><strong>{wallet ? "Payment rail connected" : "Not configured"}</strong></span></Link>
            <Link href="/skills"><Sparkles /><span><small>Skills</small><strong>{liveSkills.length} published live</strong></span></Link>
            <Link href="/rewards"><Gift /><span><small>Rewards</small><strong>{rewardAmount ? `${rewardAmount.amount} ${rewardAmount.currency}` : "No rewards issued"}</strong></span></Link>
          </div>
          <section className="muse-control__recent">
            <small>Recent</small>
            {mine.slice(0, 3).map((execution) => (
              <Link href={`/executions/${execution.id}`} key={`${execution.source}-${execution.id}`}>
                <span><strong>{execution.title}</strong><em>{execution.capability.name}</em></span>
                <StatusIndicator status={execution.status} compact />
              </Link>
            ))}
            {!mine.length && <p>No signed activity references this Muse yet.</p>}
          </section>
          <footer>
            <Link href="/humans">Hire human</Link>
            <Link href="/skills">Add skill</Link>
            <Link href="/x402">Payments</Link>
            <Link href="/rewards">Rewards</Link>
          </footer>
        </div>
      )}
    </aside>
  );
}
