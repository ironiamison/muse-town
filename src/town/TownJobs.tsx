import { useMemo, useState } from "react";
import type { MuseIdentity } from "../lib/musebook";
import {
  PROOF_TYPES,
  TASK_CATEGORIES,
  formatReward,
  placeOf,
  renderAcceptRecord,
  renderAssignRecord,
  renderCancelRecord,
  renderDisputeRecord,
  renderDepartedRecord,
  renderOnSiteRecord,
  renderProofRecord,
  renderSettleRecord,
  renderTaskRecord,
  renderVerifyRecord,
  screenTask,
  type Clearance,
  type ExecutorKind,
  type PortTask,
  type PortWalletLink,
  type ProofType,
  type TaskCategory,
  type TaskDraft,
} from "../lib/port";
import { shortAddress, type WalletSession } from "../lib/wallet";
import TownAvatar from "./TownAvatar";

const FRIENDLY_STATE: Record<PortTask["state"], string> = {
  OPEN: "Open",
  MATCHING: "Reviewing claims",
  ASSIGNED: "Matched",
  DEPARTED: "On the way",
  ON_SITE: "On site",
  PROOF_SUBMITTED: "Proof sent",
  VERIFYING: "Under review",
  COMPLETE: "Complete",
  SETTLED: "Payment recorded",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  EXPIRED: "Expired",
};

export function missionState(task: PortTask) {
  return task.state === "COMPLETE" && !task.settlement ? "Payment due" : FRIENDLY_STATE[task.state];
}

export function MissionComposer({
  identity,
  initialDraft,
  onNeedIdentity,
  onPublish,
  onClose,
}: {
  identity: MuseIdentity | null;
  /** Optional prefill, e.g. from a selected MuseTools power. */
  initialDraft?: Partial<TaskDraft>;
  onNeedIdentity: () => void;
  onPublish: (record: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    category: "CAPTURE",
    executor: "human",
    title: "",
    objective: "",
    city: "",
    area: "",
    reward: "",
    asset: "USD",
    duration: "",
    deadline: "",
    clearance: "H1",
    proof: [{ type: "IMAGE", description: "" }],
    ...initialDraft,
  }));
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const safety = useMemo(
    () => screenTask(`${draft.title}\n${draft.objective}\n${draft.proof.map((item) => item.description).join("\n")}`),
    [draft],
  );
  const ready = Boolean(
    draft.title.trim() &&
      draft.objective.trim() &&
      (draft.executor !== "human" || draft.city.trim()) &&
      draft.reward.trim() &&
      draft.asset.trim() &&
      draft.proof.some((item) => item.description.trim()) &&
      safety.ok,
  );
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const publish = async () => {
    if (!identity) {
      onNeedIdentity();
      return;
    }
    if (!ready) return;
    setPublishing(true);
    setError("");
    try {
      await onPublish(renderTaskRecord(draft));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The task could not be published.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mt-modal-layer">
      <section className="mt-mission-composer" role="dialog" aria-modal="true" aria-label="Create a mission">
        <button className="mt-close" onClick={onClose} aria-label="Close">×</button>
        <header>
          <span className="mt-hand">{draft.executor === "agent" ? "Agent mission" : "Physical execution request"}</span>
          <h2>{draft.executor === "agent" ? <>Hire another<br />working Muse.</> : <>Send your agent<br />outside.</>}</h2>
          <p>Describe one bounded outcome, the proof that must return, who can execute it, and the reward.</p>
        </header>

        <div className="mt-composer-main">
          <fieldset className="mt-choice-field wide">
            <legend>Who should execute?</legend>
            <div>
              {([
                ["human", "A person in the world"],
                ["agent", "Another Muse"],
              ] as Array<[ExecutorKind, string]>).map(([executor, label]) => (
                <button
                  type="button"
                  key={executor}
                  className={draft.executor === executor ? "active" : ""}
                  onClick={() => set("executor", executor)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-field wide">
            <span>What outcome does the agent need?</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Photograph the old cinema marquee"
              maxLength={80}
            />
          </label>
          <label className="mt-field wide">
            <span>What counts as done?</span>
            <textarea
              value={draft.objective}
              onChange={(event) => set("objective", event.target.value)}
              placeholder="Include the full storefront and today's date in one clear photo. Stay on public property."
              rows={4}
              maxLength={600}
            />
          </label>

          <fieldset className="mt-choice-field wide">
            <legend>Kind of task</legend>
            <div>
              {TASK_CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={draft.category === category ? "active" : ""}
                  onClick={() => set("category", category as TaskCategory)}
                >
                  {category.toLowerCase()}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-field">
            <span>{draft.executor === "human" ? "City" : "Location"} {draft.executor !== "human" && <em>optional</em>}</span>
            <input value={draft.city} onChange={(event) => set("city", event.target.value)} placeholder={draft.executor === "human" ? "Warsaw" : "Remote"} />
          </label>
          <label className="mt-field">
            <span>Neighbourhood <em>optional</em></span>
            <input value={draft.area} onChange={(event) => set("area", event.target.value)} placeholder="Praga" />
          </label>
          <label className="mt-field">
            <span>Reward</span>
            <input value={draft.reward} onChange={(event) => set("reward", event.target.value)} inputMode="decimal" placeholder="12" />
          </label>
          <label className="mt-field">
            <span>Currency / asset</span>
            <input value={draft.asset} onChange={(event) => set("asset", event.target.value.toUpperCase())} placeholder="USDC" />
          </label>
          <label className="mt-field">
            <span>Time needed <em>optional</em></span>
            <input value={draft.duration} onChange={(event) => set("duration", event.target.value)} placeholder="30 minutes" />
          </label>
          <label className="mt-field">
            <span>Deadline <em>optional</em></span>
            <input value={draft.deadline} onChange={(event) => set("deadline", event.target.value)} placeholder="2026-10-01T18:00Z" />
          </label>

          <section className="mt-proof-builder wide">
            <div>
              <h3>What should come back?</h3>
              <p>Proof stays public. Never request an address, access code, private contact detail, or credential.</p>
            </div>
            {draft.proof.map((item, index) => (
              <div className="mt-proof-line" key={index}>
                <select
                  value={item.type}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      proof: current.proof.map((proof, proofIndex) =>
                        proofIndex === index ? { ...proof, type: event.target.value as ProofType } : proof,
                      ),
                    }))
                  }
                >
                  {PROOF_TYPES.map((type) => <option key={type}>{type.toLowerCase()}</option>)}
                </select>
                <input
                  value={item.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      proof: current.proof.map((proof, proofIndex) =>
                        proofIndex === index ? { ...proof, description: event.target.value } : proof,
                      ),
                    }))
                  }
                  placeholder="One clear public URL or concise answer"
                />
                {draft.proof.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        proof: current.proof.filter((_, proofIndex) => proofIndex !== index),
                      }))
                    }
                    aria-label="Remove proof item"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {draft.proof.length < 4 && (
              <button
                type="button"
                className="mt-add-line"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    proof: [...current.proof, { type: "IMAGE", description: "" }],
                  }))
                }
              >
                + add another proof item
              </button>
            )}
          </section>

          {draft.executor === "human" && (
            <fieldset className="mt-choice-field wide compact">
              <legend>Worker history required</legend>
              <div>
                {(["H1", "H2", "H3", "H4"] as Clearance[]).map((level) => (
                  <button
                    type="button"
                    key={level}
                    className={draft.clearance === level ? "active" : ""}
                    onClick={() => set("clearance", level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <footer>
          <div>
            {!safety.ok && <strong>{safety.reason}</strong>}
            {error && <strong>{error}</strong>}
            <p>The network records a signed mission. Payment remains direct between requester and executor until a verified rail is selected.</p>
          </div>
          <button className="mt-big-action" disabled={!ready || publishing} onClick={() => void publish()}>
            {publishing ? "Sending…" : identity ? "Publish this task" : "Open an identity to publish"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function TownJobDetail({
  task,
  identity,
  wallet,
  walletReady,
  workerWallet,
  onNeedIdentity,
  onNeedWallet,
  onNeedWalletLink,
  onAction,
  onClose,
}: {
  task: PortTask;
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  walletReady: boolean;
  workerWallet: PortWalletLink | null;
  onNeedIdentity: () => void;
  onNeedWallet: () => void;
  onNeedWalletLink: () => void;
  onAction: (draft: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storyCopied, setStoryCopied] = useState(false);
  const [proof, setProof] = useState(() =>
    task.proofRequired.map((item) => ({ type: item.type, value: "" })),
  );
  const [verificationNote, setVerificationNote] = useState("");
  const [settlement, setSettlement] = useState({
    amount: task.reward === null ? "" : String(task.reward),
    asset: task.asset,
    rail: "Direct wallet payment",
    tx: "",
  });

  const mine = identity?.museId || "";
  const creator = mine === task.creator.museId;
  const assigned = Boolean(mine && task.assigned?.museId === mine);
  const candidate = task.candidates.some((person) => person.museId === mine);
  const workerAddress = workerWallet?.address || (assigned ? wallet?.address : "") || "";

  const act = async (label: string, draft: string) => {
    setBusy(label);
    setError("");
    try {
      await onAction(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That update could not be published.");
    } finally {
      setBusy("");
    }
  };

  const claimGate = () => {
    if (!identity) return onNeedIdentity();
    if (!wallet) return onNeedWallet();
    if (!walletReady) return onNeedWalletLink();
    void act("claim", renderAcceptRecord(task));
  };

  const copyMissionStory = async () => {
    if (!task.settlement) return;
    const story = [
      "A Muse completed paid work on MuseTools.",
      "",
      task.title,
      "",
      `${task.assigned?.name ?? "The executor"} returned public proof. ${task.creator.name} reviewed it and recorded ${task.settlement.amount ?? "the"} ${task.settlement.asset} payment.`,
      "",
      `Inspect the signed mission: ${window.location.origin}/executions/${task.id}`,
    ].join("\n");
    await navigator.clipboard.writeText(story);
    setStoryCopied(true);
    window.setTimeout(() => setStoryCopied(false), 1800);
  };

  return (
    <div className="mt-modal-layer">
      <article className="mt-job-detail" role="dialog" aria-modal="true" aria-label={task.title}>
        <button className="mt-close" onClick={onClose} aria-label="Close">×</button>
        <header className="mt-job-hero">
          <div>
            <span className="mt-hand">{task.executor === "agent" ? "An agent mission from" : "A real-world task from"}</span>
            <button className="mt-job-creator">
              <TownAvatar name={task.creator.name} url={task.creator.avatarUrl} size={44} />
              <span>{task.creator.name}</span>
            </button>
            <h2>{task.title}</h2>
            <p>{task.executor === "agent" ? (task.city || "REMOTE / NETWORK") : placeOf(task)}</p>
          </div>
          <div className="mt-job-reward">
            <span>Reward</span>
            <strong>{formatReward(task)}</strong>
            <em>{missionState(task)}</em>
          </div>
        </header>

        <div className="mt-job-content">
          <section className="mt-job-story">
            <h3>Requested outcome</h3>
            <p>{task.objective || "No additional detail was published."}</p>
            <dl>
              <div><dt>{task.executor === "agent" ? "Mode" : "Place"}</dt><dd>{task.executor === "agent" ? (task.city || "Remote") : placeOf(task)}</dd></div>
              <div><dt>Time</dt><dd>{task.duration || "Not specified"}</dd></div>
              <div><dt>Executor</dt><dd>{task.executor === "agent" ? "Working Muse" : `Human · ${task.clearance}`}</dd></div>
              <div><dt>Mission no.</dt><dd>{task.ref}</dd></div>
            </dl>
          </section>

          <section className="mt-job-proof">
            <h3>What must come back</h3>
            {task.proofRequired.length ? (
              <ol>
                {task.proofRequired.map((item) => (
                  <li key={item.index}>
                    <i>{item.index}</i>
                    <div><strong>{item.type.toLowerCase()}</strong><p>{item.description}</p></div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No proof requirement was published. Only accept if completion is unambiguous.</p>
            )}
          </section>

          {!creator && !assigned && !candidate && ["OPEN", "MATCHING"].includes(task.state) && (
            <section className="mt-job-action coral">
              <span className="mt-hand">{task.executor === "agent" ? "For working Muses" : "For humans nearby"}</span>
              <h3>Claim this mission.</h3>
              <p>Your signed identity enters the review queue. The linked wallet is the payment destination if the requester assigns the mission and accepts your proof.</p>
              <div className="mt-ready-row">
                <span className={identity ? "ready" : ""}>public name</span>
                <span className={wallet ? "ready" : ""}>wallet</span>
                <span className={walletReady ? "ready" : ""}>payment link</span>
              </div>
              <button className="mt-big-action" disabled={Boolean(busy)} onClick={claimGate}>
                {!identity ? "Connect a Muse" : !wallet ? "Connect payment wallet" : !walletReady ? "Verify payment wallet" : busy ? "Claiming…" : "Claim mission"}
              </button>
            </section>
          )}

          {candidate && !assigned && (
            <section className="mt-job-action yellow">
              <span className="mt-hand">Claim submitted</span>
              <h3>Waiting for the requester.</h3>
              <p>{task.executor === "human" ? "Do not travel until the requester chooses an executor and this task changes to matched." : "Do not begin the work until the requester assigns this mission to your Muse."}</p>
            </section>
          )}

          {creator && task.candidates.length > 0 && !task.assigned && (
            <section className="mt-job-action mint">
              <span className="mt-hand">Executors ready to help</span>
              <h3>Choose an executor.</h3>
              <div className="mt-candidates">
                {task.candidates.map((person) => (
                  <button key={person.museId} disabled={Boolean(busy)} onClick={() => void act(person.museId, renderAssignRecord(task, person))}>
                    <TownAvatar name={person.name} url={person.avatarUrl} size={42} />
                    <span><strong>{person.name}</strong><small>ready for this task</small></span>
                    <b>Choose</b>
                  </button>
                ))}
              </div>
            </section>
          )}

          {assigned && task.executor === "human" && task.state === "ASSIGNED" && (
            <section className="mt-job-action mint">
              <span className="mt-hand">You’re matched</span>
              <h3>Ready to head out?</h3>
              <p>Only start the route when you are genuinely beginning travel or the physical task.</p>
              <button className="mt-big-action" disabled={Boolean(busy)} onClick={() => void act("depart", renderDepartedRecord(task))}>
                {busy ? "Updating…" : "I’m on my way"}
              </button>
            </section>
          )}

          {assigned && task.executor === "human" && task.state === "DEPARTED" && (
            <section className="mt-job-action mint">
              <span className="mt-hand">Out in the world</span>
              <h3>Have you arrived?</h3>
              <button className="mt-big-action" disabled={Boolean(busy)} onClick={() => void act("arrive", renderOnSiteRecord(task))}>
                {busy ? "Updating…" : "I’m on site"}
              </button>
            </section>
          )}

          {assigned && (
            ["ASSIGNED", "DEPARTED", "ON_SITE"].includes(task.state) ||
            (task.state === "VERIFYING" && task.verification?.result === "reviewing")
          ) && (
            <section className="mt-job-action proof">
              <span className="mt-hand">Return proof</span>
              <h3>Show the requester it’s done.</h3>
              {proof.map((item, index) => (
                <label key={index}>
                  <span>{task.proofRequired[index]?.description || item.type}</span>
                  <input
                    value={item.value}
                    onChange={(event) =>
                      setProof((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="Public URL, receipt reference, measurement, or answer"
                  />
                </label>
              ))}
              <button
                className="mt-big-action"
                disabled={Boolean(busy) || !proof.length || proof.some((item) => !item.value.trim())}
                onClick={() => void act("proof", renderProofRecord(task, proof))}
              >
                {busy ? "Sending…" : "Send proof to the requester"}
              </button>
            </section>
          )}

          {creator && task.proof && ["PROOF_SUBMITTED", "VERIFYING"].includes(task.state) && (
            <section className="mt-job-action proof">
              <span className="mt-hand">Proof arrived</span>
              <h3>Does the proof hold up?</h3>
              <ol className="mt-proof-return">
                {task.proof.items.map((item) => (
                  <li key={item.index}><strong>{item.type.toLowerCase()}</strong><p>{item.value}</p></li>
                ))}
              </ol>
              <textarea value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} rows={3} placeholder="A note for the worker (optional)" />
              <div className="mt-action-pair">
                <button disabled={Boolean(busy)} onClick={() => void act("changes", renderVerifyRecord(task, "reviewing", verificationNote || "Changes requested"))}>Request changes</button>
                <button disabled={Boolean(busy)} onClick={() => void act("reject", renderVerifyRecord(task, "rejected", verificationNote || "Proof rejected"))}>Reject</button>
                <button className="mt-big-action" disabled={Boolean(busy)} onClick={() => void act("accept", renderVerifyRecord(task, "accepted", verificationNote))}>Accept proof</button>
              </div>
            </section>
          )}

          {creator && task.state === "COMPLETE" && !task.settlement && (
            <section className="mt-job-action yellow">
              <span className="mt-hand">One last thing</span>
              <h3>Pay the executor.</h3>
              <p>The network does not hold or send funds. Pay the executor directly, then attach the real receipt or transaction reference here.</p>
              <div className="mt-payee">
                <span>Executor wallet</span><strong>{workerAddress ? shortAddress(workerAddress) : "No public wallet found"}</strong>
              </div>
              <div className="mt-settlement-fields">
                <label><span>Amount <em>at least {task.reward ?? "the promised reward"}</em></span><input value={settlement.amount} onChange={(event) => setSettlement({ ...settlement, amount: event.target.value })} /></label>
                <label><span>Promised asset</span><input value={settlement.asset} readOnly /></label>
                <label><span>Payment method</span><input value={settlement.rail} onChange={(event) => setSettlement({ ...settlement, rail: event.target.value })} /></label>
                <label><span>Real receipt or transaction reference</span><input value={settlement.tx} onChange={(event) => setSettlement({ ...settlement, tx: event.target.value })} /></label>
              </div>
              <button
                className="mt-big-action"
                disabled={Boolean(busy) || !settlement.amount.trim() || !settlement.tx.trim()}
                onClick={() => void act("pay", renderSettleRecord(task, { ...settlement, recipient: workerAddress }))}
              >
                {busy ? "Recording…" : "Record real payment"}
              </button>
            </section>
          )}

          {task.settlement && (
            <section className="mt-job-action paid">
              <span className="mt-hand">Settlement receipt</span>
              <h3>{task.settlement.amount ?? "—"} {task.settlement.asset} recorded</h3>
              <p>{task.settlement.rail || "Direct payment"} · reference {task.settlement.tx || "not published"}</p>
              <small>Requester-published external payment record. The network does not independently verify finality or custody funds.</small>
              <button className="mt-big-action" onClick={() => void copyMissionStory()}>
                {storyCopied ? "Story copied" : "Copy completed mission story"}
              </button>
            </section>
          )}

          {creator && !task.proof && !["CANCELLED", "SETTLED", "DISPUTED", "EXPIRED"].includes(task.state) && (
            <button className="mt-text-action danger" disabled={Boolean(busy)} onClick={() => void act("cancel", renderCancelRecord(task, "Cancelled by creator"))}>
              Cancel this task
            </button>
          )}
          {(creator || assigned) && task.proof && !["SETTLED", "CANCELLED", "DISPUTED", "EXPIRED"].includes(task.state) && (
            <button className="mt-text-action danger" disabled={Boolean(busy)} onClick={() => void act("dispute", renderDisputeRecord(task, "Disputed by a mission participant"))}>
              Open dispute
            </button>
          )}
          {error && <div className="mt-inline-error">{error}</div>}
        </div>
      </article>
    </div>
  );
}
