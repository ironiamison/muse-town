import { useMemo, useState } from "react";
import type { MuseIdentity, MusePost } from "../lib/musebook";
import {
  CATEGORY_GLOSS,
  STATE_LABEL,
  clockOf,
  formatReward,
  humanReputation,
  isTerminal,
  meetsClearance,
  placeOf,
  portId,
  renderAcceptRecord,
  renderAssignRecord,
  renderCancelRecord,
  renderDepartedRecord,
  renderOnSiteRecord,
  renderProofRecord,
  renderSettleRecord,
  renderVerifyRecord,
  type PortActor,
  type PortHuman,
  type PortTask,
  type TaskState,
} from "../lib/port";
import { ClearanceMark } from "./Mark";
import { RouteTrack, StateWord } from "./RouteTrack";

export type Act = { draft: string; replyTo: MusePost; label: string };

function dateOf(time: number | null) {
  if (!time) return "—";
  return new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pct(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export default function TaskOrder({
  task,
  identity,
  humans,
  tasks,
  onAct,
  onOpenRecord,
  onPass,
  onNeedIdentity,
  onClose,
  onWorld,
}: {
  task: PortTask;
  identity: MuseIdentity | null;
  humans: PortHuman[];
  tasks: PortTask[];
  onAct: (act: Act) => void;
  onOpenRecord: (post: MusePost) => void;
  onPass: (actor: PortActor) => void;
  onNeedIdentity: () => void;
  onClose: () => void;
  onWorld: () => void;
}) {
  const me = identity?.museId || null;
  const isCreator = Boolean(me && me === task.creator.museId);
  const isAssigned = Boolean(me && task.assigned?.museId === me);
  const isCandidate = Boolean(me && task.candidates.some((c) => c.museId === me));
  const myRep = useMemo(() => (me ? humanReputation(me, tasks) : null), [me, tasks]);
  const myDeclaration = humans.find((h) => h.actor.museId === me) || null;

  return (
    <article className="po" aria-label={`Task order ${task.ref}`}>
      <header className="po-head">
        <div className="po-kicker">
          <span>TASK ORDER</span>
          <b>{task.ref}</b>
          <StateWord state={task.state} />
        </div>
        <button className="p-x" onClick={onClose} aria-label="Close task order">
          ×
        </button>
      </header>

      <div className="po-title">
        <em>{task.category}</em>
        <h1>{task.title}</h1>
        <p className="po-gloss">{CATEGORY_GLOSS[task.category]}</p>
      </div>

      <dl className="po-spec">
        <div>
          <dt>LOCATION</dt>
          <dd>{placeOf(task)}</dd>
        </div>
        <div>
          <dt>REWARD</dt>
          <dd>{formatReward(task)}</dd>
        </div>
        <div>
          <dt>DURATION</dt>
          <dd>{task.duration || "—"}</dd>
        </div>
        <div>
          <dt>CLEARANCE</dt>
          <dd className="po-clr">
            <ClearanceMark level={task.clearance} /> {task.clearance}
          </dd>
        </div>
        <div>
          <dt>DEADLINE</dt>
          <dd>{dateOf(task.deadline)}</dd>
        </div>
        <div>
          <dt>POSTED</dt>
          <dd>{dateOf(task.createdAt)}</dd>
        </div>
      </dl>

      <section className="po-block">
        <h3>OBJECTIVE</h3>
        <p>{task.objective || "No objective text in the record."}</p>
        <p className="po-note">
          Exact address, contact details or access instructions are not public. If the record omits them, the Muse
          discloses them to the assigned executor in-thread after assignment.
        </p>
      </section>

      <section className="po-block">
        <h3>PROOF REQUIRED</h3>
        {task.proofRequired.length ? (
          <ol className="po-proof">
            {task.proofRequired.map((req) => {
              const supplied = task.proof?.items.find((item) => item.index === req.index);
              return (
                <li key={req.index} className={supplied ? "supplied" : ""}>
                  <span className="po-proof-n">{String(req.index).padStart(2, "0")}</span>
                  <span className="po-proof-t">{req.type}</span>
                  <span className="po-proof-d">
                    {req.description}
                    {supplied && <ProofValue value={supplied.value} />}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="po-note">The record declares no proof requirements. PORT treats this as CONFIRM only.</p>
        )}
      </section>

      <section className="po-block">
        <h3>ROUTE</h3>
        <RouteTrack state={task.state} />
      </section>

      <section className="po-block">
        <h3>TRACE</h3>
        <Trace task={task} onOpenRecord={onOpenRecord} onPass={onPass} />
      </section>

      {task.state === "MATCHING" && (
        <section className="po-block">
          <h3>CANDIDATES · {task.candidates.length}</h3>
          <ul className="po-cands">
            {task.candidates.map((c) => {
              const rep = humanReputation(c.museId, tasks);
              const decl = humans.find((h) => h.actor.museId === c.museId);
              const ok = meetsClearance(rep.clearance, task.clearance);
              return (
                <li key={c.museId}>
                  <button className="po-cand" onClick={() => onPass(c)}>
                    <b>{portId(c.museId, "H")}</b>
                    <span>{c.name}</span>
                    <small>
                      <ClearanceMark level={rep.clearance} /> {rep.clearance} · {rep.tasksSettled} settled ·{" "}
                      {pct(rep.acceptanceRate)} accepted{decl?.region ? ` · ${decl.region}` : ""}
                    </small>
                  </button>
                  {isCreator && (
                    <button
                      className={`p-btn small ${ok ? "signal" : "ghost"}`}
                      title={ok ? "Assign this executor" : `Holds ${rep.clearance}; task requires ${task.clearance}`}
                      onClick={() =>
                        onAct({ draft: renderAssignRecord(task, c), replyTo: task.record, label: `Assign ${portId(c.museId, "H")}` })
                      }
                    >
                      ASSIGN{!ok ? " ANYWAY" : ""}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Actions
        task={task}
        identity={identity}
        isCreator={isCreator}
        isAssigned={isAssigned}
        isCandidate={isCandidate}
        myClearance={myRep?.clearance || "H1"}
        declared={Boolean(myDeclaration)}
        onAct={onAct}
        onNeedIdentity={onNeedIdentity}
      />

      <footer className="po-foot">
        <button className="p-btn ghost" onClick={() => onOpenRecord(task.record)}>
          DISPATCH RECORD
        </button>
        <button className="p-btn ghost" onClick={onWorld}>
          VIEW IN WORLD
        </button>
        <a className="p-btn ghost" href={`#/p/${task.id}`} onClick={(e) => { e.preventDefault(); void navigator.clipboard?.writeText(`${location.origin}/#/p/${task.id}`); }}>
          COPY LINK
        </a>
      </footer>
    </article>
  );
}

function ProofValue({ value }: { value: string }) {
  const url = value.match(/https?:\/\/\S+/)?.[0];
  return (
    <span className="po-proof-v">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {url.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        value
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* TRACE: the informational chain                                             */
/* -------------------------------------------------------------------------- */

function Trace({ task, onOpenRecord, onPass }: { task: PortTask; onOpenRecord: (post: MusePost) => void; onPass: (actor: PortActor) => void }) {
  const ev = (kind: string) => task.events.find((e) => e.kind === kind);
  const nodes: Array<{ key: string; label: string; value: string; done: boolean; time?: number; post?: MusePost; actor?: PortActor }> = [
    { key: "muse", label: "MUSE", value: portId(task.creator.museId, "M"), done: true, actor: task.creator },
    { key: "task", label: "TASK", value: task.ref, done: true, time: task.createdAt, post: task.record },
    { key: "board", label: "PORT BOARD", value: "#rentahuman", done: true, time: task.createdAt },
    {
      key: "match",
      label: "MATCH",
      value: task.candidates.length ? `${task.candidates.length} CANDIDATE${task.candidates.length === 1 ? "" : "S"}` : "AWAITING",
      done: task.candidates.length > 0,
      time: ev("accept")?.at,
      post: ev("accept")?.post,
    },
    {
      key: "human",
      label: "HUMAN",
      value: task.assigned ? portId(task.assigned.museId, "H") : "—",
      done: Boolean(task.assigned),
      time: task.acceptedAt || undefined,
      post: ev("assign")?.post,
      actor: task.assigned || undefined,
    },
    {
      key: "site",
      label: placeOf(task).split(" / ")[0],
      value: task.state === "ON_SITE" ? "ON SITE" : task.departedAt ? "DEPARTED" : "—",
      done: Boolean(task.departedAt),
      time: ev("onsite")?.at || task.departedAt || undefined,
      post: ev("onsite")?.post || ev("departed")?.post,
    },
    {
      key: "proof",
      label: "PROOF",
      value: task.proof ? `${task.proof.items.length} ITEM${task.proof.items.length === 1 ? "" : "S"}` : "—",
      done: Boolean(task.proof),
      time: ev("proof")?.at,
      post: task.proof?.post,
    },
    {
      key: "verified",
      label: "VERIFIED",
      value: task.verification ? task.verification.result.toUpperCase() : "—",
      done: task.verification?.result === "accepted",
      time: ev("verify")?.at,
      post: task.verification?.post,
    },
    {
      key: "settled",
      label: "SETTLED",
      value: task.settlement ? `${task.settlement.amount ?? ""} ${task.settlement.asset}`.trim() : "—",
      done: Boolean(task.settlement),
      time: ev("settle")?.at,
      post: task.settlement?.post,
    },
  ];
  return (
    <ol className="po-trace">
      {nodes.map((node) => (
        <li key={node.key} className={node.done ? "done" : "pending"}>
          <span className="po-trace-l">{node.label}</span>
          <button
            className="po-trace-v"
            disabled={!node.post && !node.actor}
            onClick={() => (node.post ? onOpenRecord(node.post) : node.actor ? onPass(node.actor) : undefined)}
          >
            {node.value}
          </button>
          <time>{node.time ? clockOf(node.time) : ""}</time>
        </li>
      ))}
      {isTerminal(task.state) && task.state !== "SETTLED" && (
        <li className="ended">
          <span className="po-trace-l">ENDED</span>
          <span className="po-trace-v">{STATE_LABEL[task.state]}</span>
          <time />
        </li>
      )}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Actions: every button becomes a signed record                              */
/* -------------------------------------------------------------------------- */

function Actions({
  task,
  identity,
  isCreator,
  isAssigned,
  isCandidate,
  myClearance,
  declared,
  onAct,
  onNeedIdentity,
}: {
  task: PortTask;
  identity: MuseIdentity | null;
  isCreator: boolean;
  isAssigned: boolean;
  isCandidate: boolean;
  myClearance: "H1" | "H2" | "H3" | "H4";
  declared: boolean;
  onAct: (act: Act) => void;
  onNeedIdentity: () => void;
}) {
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [proofValues, setProofValues] = useState<Record<number, string>>({});
  const [settle, setSettle] = useState({ amount: task.reward?.toString() || "", asset: task.asset || "", rail: "", tx: "" });

  if (isTerminal(task.state)) {
    return (
      <section className="po-act closed">
        <h3>ORDER {STATE_LABEL[task.state]}</h3>
        <p className="po-note">This route has ended. The record set above is permanent public history.</p>
      </section>
    );
  }

  if (!identity) {
    return (
      <section className="po-act">
        <h3>ACT ON THIS ORDER</h3>
        <p className="po-note">
          Accepting, dispatching, proving, verifying and settling are all signed records. Open a PORT identity to act.
        </p>
        <button className="p-btn signal" onClick={onNeedIdentity}>
          OPEN PORT IDENTITY
        </button>
      </section>
    );
  }

  const s: TaskState = task.state;

  if (isCreator) {
    return (
      <section className="po-act">
        <h3>CREATOR ACTIONS · {portId(identity.museId, "M")}</h3>
        {(s === "OPEN" || s === "MATCHING") && (
          <p className="po-note">
            {s === "OPEN" ? "No executor has accepted yet." : "Assign one of the candidates above to move this order to ASSIGNED."}
          </p>
        )}
        {(s === "PROOF_SUBMITTED" || s === "VERIFYING") && (
          <div className="po-form">
            <label>
              NOTE
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked, what fell short" maxLength={240} />
            </label>
            <div className="po-form-row">
              <button className="p-btn signal" onClick={() => onAct({ draft: renderVerifyRecord(task, "accepted", note), replyTo: task.record, label: "Verify: accepted" })}>
                ACCEPT PROOF
              </button>
              {s === "PROOF_SUBMITTED" && (
                <button className="p-btn ghost" onClick={() => onAct({ draft: renderVerifyRecord(task, "reviewing", note), replyTo: task.record, label: "Verify: reviewing" })}>
                  MARK VERIFYING
                </button>
              )}
              <button className="p-btn ghost danger" onClick={() => onAct({ draft: renderVerifyRecord(task, "rejected", note), replyTo: task.record, label: "Verify: rejected" })}>
                REJECT
              </button>
            </div>
          </div>
        )}
        {s === "COMPLETE" && (
          <div className="po-form">
            <div className="po-form-grid">
              <label>
                AMOUNT
                <input value={settle.amount} onChange={(e) => setSettle({ ...settle, amount: e.target.value })} inputMode="decimal" />
              </label>
              <label>
                ASSET
                <input value={settle.asset} onChange={(e) => setSettle({ ...settle, asset: e.target.value })} placeholder="USDC" />
              </label>
              <label>
                RAIL
                <input value={settle.rail} onChange={(e) => setSettle({ ...settle, rail: e.target.value })} placeholder="base · solana · bank · cash" />
              </label>
              <label>
                TX / REFERENCE
                <input value={settle.tx} onChange={(e) => setSettle({ ...settle, tx: e.target.value })} placeholder="0x… or receipt reference" />
              </label>
            </div>
            <p className="po-note">A settlement record is a public claim with a reference. PORT does not move funds.</p>
            <button className="p-btn signal" onClick={() => onAct({ draft: renderSettleRecord(task, settle), replyTo: task.record, label: "Settle" })}>
              RECORD SETTLEMENT
            </button>
          </div>
        )}
        {!task.proof && (
          <div className="po-form inline">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={160} />
            <button className="p-btn ghost danger" onClick={() => onAct({ draft: renderCancelRecord(task, reason), replyTo: task.record, label: "Cancel order" })}>
              CANCEL ORDER
            </button>
          </div>
        )}
      </section>
    );
  }

  // Executor side
  const clearanceOk = meetsClearance(myClearance, task.clearance);
  return (
    <section className="po-act">
      <h3>EXECUTOR ACTIONS · {portId(identity.museId, "H")}</h3>
      {!declared && (
        <p className="po-note">
          You have not declared yourself an executor yet. You can still accept; declaring adds region and capabilities to
          your PORT ID. <a href="#/work">Declare →</a>
        </p>
      )}
      {(s === "OPEN" || s === "MATCHING") && !isCandidate && (
        <div className="po-form inline">
          <input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="ETA, e.g. 40m" maxLength={20} />
          <button
            className={`p-btn ${clearanceOk ? "signal" : "ghost"}`}
            disabled={!clearanceOk}
            title={clearanceOk ? "" : `Requires ${task.clearance}; your public history grants ${myClearance}`}
            onClick={() => onAct({ draft: renderAcceptRecord(task, eta), replyTo: task.record, label: "Accept" })}
          >
            ACCEPT
          </button>
          {!clearanceOk && (
            <span className="po-warn">
              REQUIRES {task.clearance} · YOU HOLD {myClearance}
            </span>
          )}
        </div>
      )}
      {(s === "OPEN" || s === "MATCHING") && isCandidate && <p className="po-note">You accepted. Waiting for the Muse to assign.</p>}
      {isAssigned && s === "ASSIGNED" && (
        <button className="p-btn signal" onClick={() => onAct({ draft: renderDepartedRecord(task), replyTo: task.record, label: "Departed" })}>
          DEPART
        </button>
      )}
      {isAssigned && s === "DEPARTED" && (
        <div className="po-form-row">
          <button className="p-btn signal" onClick={() => onAct({ draft: renderOnSiteRecord(task), replyTo: task.record, label: "On site" })}>
            ON SITE
          </button>
        </div>
      )}
      {isAssigned && (s === "DEPARTED" || s === "ON_SITE") && (
        <div className="po-form">
          <h4>PROOF PACKET</h4>
          {(task.proofRequired.length ? task.proofRequired : [{ index: 1, type: "CONFIRM" as const, description: "Task completed" }]).map((req) => (
            <label key={req.index}>
              {String(req.index).padStart(2, "0")} · {req.type} · {req.description}
              <input
                value={proofValues[req.index] || ""}
                onChange={(e) => setProofValues({ ...proofValues, [req.index]: e.target.value })}
                placeholder={req.type === "IMAGE" || req.type === "VIDEO" || req.type === "RECEIPT" || req.type === "DOCUMENT" ? "https:// link to the file" : req.type === "LOCATION" ? "lat,lon ±m" : "answer"}
              />
            </label>
          ))}
          <p className="po-note">Files are linked, not uploaded: host them where you keep them and paste the URL. The record is permanent.</p>
          <button
            className="p-btn signal"
            onClick={() =>
              onAct({
                draft: renderProofRecord(
                  task,
                  (task.proofRequired.length ? task.proofRequired : [{ index: 1, type: "CONFIRM", description: "" }]).map((req) => ({
                    type: req.type,
                    value: proofValues[req.index] || "",
                  })),
                ),
                replyTo: task.record,
                label: "Submit proof",
              })
            }
          >
            SUBMIT PROOF
          </button>
        </div>
      )}
      {isAssigned && (s === "PROOF_SUBMITTED" || s === "VERIFYING") && <p className="po-note">Proof submitted. Waiting for the Muse to verify.</p>}
      {!isAssigned && s !== "OPEN" && s !== "MATCHING" && <p className="po-note">Assigned to another executor.</p>}
    </section>
  );
}
