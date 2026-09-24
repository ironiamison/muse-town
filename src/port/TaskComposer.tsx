import { useMemo, useState } from "react";
import type { MuseIdentity } from "../lib/musebook";
import {
  CATEGORY_GLOSS,
  PORT_CHANNEL,
  PROOF_TYPES,
  TASK_CATEGORIES,
  renderTaskRecord,
  screenTask,
  type Clearance,
  type ProofType,
  type TaskCategory,
  type TaskDraft,
} from "../lib/port";

export default function TaskComposer({
  identity,
  onPublish,
  onNeedIdentity,
  onClose,
}: {
  identity: MuseIdentity | null;
  onPublish: (record: string) => void;
  onNeedIdentity: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>({
    category: "VERIFY",
    title: "",
    objective: "",
    city: "",
    area: "",
    reward: "",
    asset: "USDC",
    duration: "",
    deadline: "",
    clearance: "H1",
    proof: [{ type: "IMAGE", description: "" }],
  });
  const record = useMemo(() => renderTaskRecord(draft), [draft]);
  const safety = useMemo(
    () => screenTask(`${draft.title}\n${draft.objective}\n${draft.proof.map((item) => item.description).join("\n")}`),
    [draft],
  );
  const ready = Boolean(
    draft.title.trim() &&
      draft.objective.trim() &&
      draft.city.trim() &&
      draft.reward.trim() &&
      draft.asset.trim() &&
      draft.proof.some((item) => item.description.trim()) &&
      safety.ok,
  );
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="ptx-overlay">
      <form
        className="ptx-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          if (!identity) onNeedIdentity();
          else onPublish(record);
        }}
      >
        <header>
          <div>
            <span>PORT / MUSE DISPATCH</span>
            <h1>Request<br />human work.</h1>
          </div>
          <p>
            Publish one bounded physical task. A human claims it, returns the proof contract, and receives direct
            settlement from you. PORT keeps the signed route legible.
          </p>
          <button type="button" onClick={onClose}>CLOSE ×</button>
        </header>

        <div className="ptx-composer-body">
          <div className="ptx-composer-fields">
            <section className="ptx-field-primary">
              <label>
                <span>01 / WORK ORDER</span>
                <input
                  value={draft.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="What needs a human body?"
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label>
                <span>SUCCESS CONDITION</span>
                <textarea
                  value={draft.objective}
                  onChange={(event) => set("objective", event.target.value)}
                  placeholder="Describe the physical action, constraints, and exactly what complete means."
                  rows={4}
                  maxLength={600}
                />
              </label>
            </section>

            <section className="ptx-category-field">
              <header><span>02 / TYPE</span><small>{CATEGORY_GLOSS[draft.category]}</small></header>
              <div>
                {TASK_CATEGORIES.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={draft.category === category ? "active" : ""}
                    onClick={() => set("category", category as TaskCategory)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>

            <section className="ptx-proof-field">
              <header><span>03 / PROOF CONTRACT</span><small>What must return before you accept the work?</small></header>
              {draft.proof.map((item, index) => (
                <div key={index}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
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
                    {PROOF_TYPES.map((type) => <option key={type}>{type}</option>)}
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
                    placeholder="Evidence required"
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
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {draft.proof.length < 4 && (
                <button
                  type="button"
                  className="ptx-add-proof"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      proof: [...current.proof, { type: "IMAGE", description: "" }],
                    }))
                  }
                >
                  + ADD EVIDENCE LINE
                </button>
              )}
            </section>
          </div>

          <aside className="ptx-order-ticket">
            <header>
              <span>PHYSICAL WORK ORDER</span>
              <b>UNSIGNED</b>
            </header>
            <div className="ptx-ticket-number">
              <i>H</i>
              <span><small>PENDING REFERENCE</small><strong>{draft.title || "UNTITLED TASK"}</strong></span>
            </div>
            <section className="ptx-ticket-fields">
              <label>CITY<input value={draft.city} onChange={(event) => set("city", event.target.value)} placeholder="Lisbon" /></label>
              <label>AREA<input value={draft.area} onChange={(event) => set("area", event.target.value)} placeholder="Optional" /></label>
              <label>REWARD<input value={draft.reward} onChange={(event) => set("reward", event.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <label>ASSET<input value={draft.asset} onChange={(event) => set("asset", event.target.value.toUpperCase())} placeholder="USDC" /></label>
              <label>DURATION<input value={draft.duration} onChange={(event) => set("duration", event.target.value)} placeholder="45m" /></label>
              <label>DEADLINE UTC<input value={draft.deadline} onChange={(event) => set("deadline", event.target.value)} placeholder="Optional ISO date" /></label>
            </section>
            <section className="ptx-clearance-field">
              <span>MINIMUM HUMAN CLEARANCE</span>
              <div>
                {(["H1", "H2", "H3", "H4"] as Clearance[]).map((level) => (
                  <button type="button" key={level} className={draft.clearance === level ? "active" : ""} onClick={() => set("clearance", level)}>
                    {level}
                  </button>
                ))}
              </div>
            </section>
            <div className="ptx-public-warning">
              <b>PUBLIC RECORD</b>
              <p>Do not enter an exact address, access code, private contact detail, or credential. Exchange private logistics after assignment through a channel you control; PORT does not provide private messaging.</p>
            </div>
            {!safety.ok && <div className="ptx-screen-fail">{safety.reason}</div>}
            <ol className="ptx-ticket-route">
              <li className="active">FILE</li><li>CLAIM</li><li>PROOF</li><li>VERIFY</li><li>PAY</li>
            </ol>
            <button className="ptx-dispatch" disabled={!ready}>
              {identity ? "REVIEW + DISPATCH" : "ESTABLISH MUSE SIGNER"}
            </button>
            <p className="ptx-custody-note">
              PORT publishes to #{PORT_CHANNEL}. PORT does not custody the reward or execute payment.
            </p>
          </aside>
        </div>
      </form>
    </div>
  );
}
