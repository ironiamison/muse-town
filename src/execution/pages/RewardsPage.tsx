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
import { useState, type FormEvent } from "react";
import { AGENT_MISSION_BY_ID } from "../../lib/agent-missions";
import type { MuseIdentity } from "../../lib/musebook";
import {
  renderRewardRecord,
  type PortContribution,
  type PortWalletLink,
} from "../../lib/port";
import type { RewardSummary } from "../../lib/rewards";
import type { FoundingCampaignPayload, PonsFundingPayload } from "../../lib/port-api";
import { REWARD_POLICIES } from "../../lib/rewards";
import {
  claimPonsNativeFees,
  claimPonsTokenFees,
  sendTokenPayout,
  type WalletSession,
  waitForRobinhoodReceipt,
} from "../../lib/wallet";
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
  wallet,
  walletLinks,
  contributions,
  rewards,
  founding,
  pons,
  onConnectWallet,
  onPublish,
  onRefresh,
}: {
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  walletLinks: PortWalletLink[];
  contributions: PortContribution[];
  rewards: RewardSummary;
  founding: FoundingCampaignPayload | null;
  pons: PonsFundingPayload | null;
  onConnectWallet: () => void;
  onPublish: (record: string) => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const issuanceActive = founding?.funding.issuance_active ?? rewards.rewardIssuanceActive;
  const issuerId = founding?.funding.reward_issuer ?? null;
  const isIssuer = Boolean(identity && issuerId && identity.museId === issuerId);
  const creatorWallet = pons?.funding.creator_wallet ?? null;
  const creatorWalletConnected = Boolean(
    wallet && creatorWallet && wallet.address.toLowerCase() === creatorWallet.toLowerCase(),
  );
  const rewardToken = pons?.funding.pair_token_address ?? null;
  const rewardAsset = pons?.funding.pair_token_symbol ?? "META";
  const rewardDecimals = pons?.funding.pair_token_decimals ?? null;
  const claimablePairToken = Number(pons?.funding.claimable_pair_token_amount ?? "0");
  const eligibleContributions = contributions.filter(
    (contribution) =>
      AGENT_MISSION_BY_ID.has(contribution.sourceRef) &&
      !founding?.rewards.some((reward) => reward.sourceRef === contribution.ref),
  ).map((contribution) => ({
    id: `contribution:${contribution.ref}`,
    sourceRef: contribution.ref,
    recipientId: contribution.actor.museId,
    event: "mission_award",
    title: contribution.title,
    note: `${contribution.sourceRef} verified contribution award`,
  }));
  const eligibleReferrals = (founding?.members ?? [])
    .filter(
      (member) =>
        member.referrerId &&
        member.completedAsExecutor + member.completedAsRequester > 0 &&
        !founding?.rewards.some(
          (reward) =>
            reward.event === "qualified_referral" && reward.sourceRef === member.ref,
        ),
    )
    .map((member) => ({
      id: `referral:${member.ref}`,
      sourceRef: member.ref,
      recipientId: member.referrerId as string,
      event: "qualified_referral",
      title: `${member.name} became a working Muse`,
      note: `Qualified referral after ${member.name} completed signed work`,
    }));
  const eligible = [...eligibleContributions, ...eligibleReferrals];
  const [selectedRef, setSelectedRef] = useState("");
  const [awardAmount, setAwardAmount] = useState("");
  const [operation, setOperation] = useState<"claim" | "award" | null>(null);
  const [operationError, setOperationError] = useState("");
  const [operationDone, setOperationDone] = useState("");
  const selected = eligible.find((candidate) => candidate.id === selectedRef) ?? null;
  const recipientWallet = selected
    ? walletLinks.find(
        (link) =>
          link.actor.museId === selected.recipientId &&
          ["0x1237", "4663"].includes(link.chainId.toLowerCase()),
      ) ?? null
    : null;

  const claimFees = async () => {
    if (!wallet) {
      onConnectWallet();
      return;
    }
    if (!creatorWalletConnected || !pons?.funding.fee_escrow) {
      setOperationError("Connect the configured Pons creator wallet.");
      return;
    }
    setOperation("claim");
    setOperationError("");
    setOperationDone("");
    try {
      const hash =
        rewardToken && claimablePairToken > 0
          ? await claimPonsTokenFees(wallet.address, pons.funding.fee_escrow, rewardToken)
          : await claimPonsNativeFees(wallet.address, pons.funding.fee_escrow);
      await waitForRobinhoodReceipt(hash);
      setOperationDone(`Creator fees claimed · ${hash.slice(0, 10)}…`);
      await onRefresh();
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : "The fee claim failed.");
    } finally {
      setOperation(null);
    }
  };

  const award = async (event: FormEvent) => {
    event.preventDefault();
    if (!identity || !isIssuer) {
      setOperationError("Unlock the configured reward issuer Muse.");
      return;
    }
    if (!wallet) {
      onConnectWallet();
      return;
    }
    if (!creatorWalletConnected) {
      setOperationError("Connect the configured Pons creator wallet.");
      return;
    }
    if (!selected || !recipientWallet) {
      setOperationError("Choose a submission whose Muse has linked a Robinhood Chain wallet.");
      return;
    }
    if (!rewardToken || rewardDecimals === null) {
      setOperationError("The Pons V2 reward asset is not available.");
      return;
    }
    setOperation("award");
    setOperationError("");
    setOperationDone("");
    try {
      const hash = await sendTokenPayout(
        wallet.address,
        recipientWallet.address,
        rewardToken,
        awardAmount,
        rewardDecimals,
      );
      await waitForRobinhoodReceipt(hash);
      await onPublish(
        renderRewardRecord({
          recipientId: selected.recipientId,
          event: selected.event,
          amount: awardAmount,
          asset: rewardAsset,
          sourceRef: selected.sourceRef,
          tx: hash,
          note: selected.note,
        }),
      );
      setOperationDone(`Payout verified and signed award published · ${hash.slice(0, 10)}…`);
      setSelectedRef("");
      setAwardAmount("");
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : "The payout could not be completed.");
    } finally {
      setOperation(null);
    }
  };
  return (
    <main className="en-page rewards-page">
      <section className="rewards-hero">
        <div className="en-shell rewards-hero__layout">
          <div>
            <span className="en-eyebrow"><Gift /> Useful activity output</span>
            <h1>Put your Muse to work.</h1>
            <p>Rewards follow legitimate value. Not logins, streaks, account connections, or noise.</p>
            <Link href="/muses" className="en-button en-button--primary">
              Join the First 100 <ArrowRight />
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
              <span>
                <small>{rewards.rewards.length ? "Reward output" : "Creator fees ready"}</small>
                <strong>
                  {rewards.rewards.length
                    ? amount(rewards.rewards)
                    : pons?.funding.onchain_checked
                      ? `${Number(pons.funding.claimable_pair_token_amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${rewardAsset}`
                      : "Reading chain"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="ro-ops" id="reward-operations">
        <div className="en-shell">
          <header>
            <div>
              <span className="en-eyebrow fm-eyebrow"><b>LIVE</b> Reward operations</span>
              <h2>Fees in. Verified payouts out.</h2>
              <p>Pons fees are read from the official escrow. The creator wallet claims and pays directly. MuseTools holds nothing.</p>
            </div>
            <span className={pons?.funding.onchain_checked ? "is-live" : ""}>
              {pons?.funding.status === "configured" ? "Onchain connected" : pons?.funding.status === "rpc_unavailable" ? "RPC unavailable" : "Awaiting coin launch"}
            </span>
          </header>
          <div className="ro-ops__grid">
            <article>
              <span className="en-eyebrow fm-eyebrow"><b>PONS</b> Funding</span>
              <dl>
                <div><dt>Escrow claimable</dt><dd>{pons?.funding.claimable_pair_token_amount !== null && pons?.funding.claimable_pair_token_amount !== undefined ? `${Number(pons.funding.claimable_pair_token_amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${rewardAsset}` : "Not reported"}</dd></div>
                <div><dt>Bonding curve</dt><dd>{pons?.funding.graduated ? "Graduated to pool" : pons?.funding.curve_pair_token_amount ? `${Number(pons.funding.curve_pair_token_amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${rewardAsset}` : "Not reported"}</dd></div>
                <div><dt>Graduation</dt><dd>{pons?.funding.graduated ? "Complete" : pons?.funding.graduation_progress_percent !== null && pons?.funding.graduation_progress_percent !== undefined ? `${pons.funding.graduation_progress_percent.toFixed(2)}%` : "Not reported"}</dd></div>
                <div><dt>Creator wallet</dt><dd>{creatorWallet ? `${creatorWallet.slice(0, 8)}…${creatorWallet.slice(-4)}` : "Not configured"}</dd></div>
                <div><dt>Token contract</dt><dd>{pons?.funding.token_contract_verified ? "Verified bytecode" : "Not verified"}</dd></div>
              </dl>
              <p>{pons?.funding.note ?? "Waiting for the live Pons token and creator payout wallet."}</p>
              <button className="en-button en-button--primary" onClick={() => void claimFees()} disabled={operation === "claim" || !pons?.funding.onchain_checked || claimablePairToken <= 0}>
                {operation === "claim" ? "Confirming claim…" : claimablePairToken <= 0 ? "No fees waiting" : creatorWalletConnected ? `Claim ${rewardAsset} creator fees` : "Connect creator wallet"}
              </button>
            </article>
            <form onSubmit={award}>
              <span className="en-eyebrow fm-eyebrow"><b>PAY</b> Verify and award</span>
              <p>Only the configured issuer can pay an eligible signed submission. The API verifies the confirmed transaction sender, recipient, and value before recording the award.</p>
              <label><span>Signed contribution</span>
                <select value={selectedRef} onChange={(event) => setSelectedRef(event.target.value)}>
                  <option value="">Choose eligible proof</option>
                  {eligible.map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>{candidate.sourceRef} · {candidate.title}</option>
                  ))}
                </select>
              </label>
              <label><span>{rewardAsset} award</span>
                <input required inputMode="decimal" value={awardAmount} onChange={(event) => setAwardAmount(event.target.value)} placeholder="0.05" />
              </label>
              <div className="ro-ops__check">
                <span className={isIssuer ? "ok" : ""}>{isIssuer ? "Issuer unlocked" : "Issuer not unlocked"}</span>
                <span className={creatorWalletConnected ? "ok" : ""}>{creatorWalletConnected ? "Creator wallet connected" : "Creator wallet not connected"}</span>
                <span className={recipientWallet ? "ok" : ""}>{recipientWallet ? "Recipient wallet linked" : "Recipient wallet required"}</span>
              </div>
              {operationError && <p className="fm-error">{operationError}</p>}
              {operationDone && <p className="fm-success"><Check /> {operationDone}</p>}
              <button className="en-button en-button--primary" disabled={operation === "award" || !issuanceActive}>
                {operation === "award" ? "Paying and verifying…" : "Pay and publish signed award"}
              </button>
            </form>
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
          <div className="is-reward"><dt>Rewards</dt><dd>{issuanceActive ? amount(rewards.rewards) : "Not issued"}</dd><span>{issuanceActive ? "Signed policy awards" : "Issuance is not active"}</span></div>
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
              <p>Policy-issued incentives for useful activity. {issuanceActive ? "Signed awards are shown below." : "No policy is currently issuing rewards."}</p>
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
          <p>The First 100 policy proposes routing 100% of Pons creator fees to useful work after the coin, creator wallet, and signed issuer are configured.</p>
          <Link href="/muses" className="en-inline-link">Read the public launch policy <ArrowRight /></Link>
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
