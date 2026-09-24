import { useMemo, useState } from "react";
import type { MuseIdentity, MusePost } from "../lib/musebook";
import {
  ROUTE_STATIONS,
  STATE_LABEL,
  clockOf,
  formatReward,
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
  stationIndex,
  type PortTask,
  type PortWalletLink,
} from "../lib/port";
import { chainLabel, shortAddress, type WalletSession } from "../lib/wallet";

type TaskAction = { draft: string; replyTo: MusePost };

function dateTime(time: number | null) {
  if (!time) return "NO DEADLINE";
  return new Date(time)
    .toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function eventLabel(task: PortTask, index: number) {
  if (index === 0) return "TASK FILED";
  const event = task.events[index - 1];
  if (!event) return "PUBLIC RECORD";
  if (event.kind === "accept") return "CANDIDATE ENTERED";
  if (event.kind === "assign") return "ROUTE ASSIGNED";
  if (event.kind === "departed") return "DEPARTED";
  if (event.kind === "onsite") return "ON SITE";
  if (event.kind === "proof") return "PROOF SUBMITTED";
  if (event.kind === "verify") return `PROOF ${(event.fields.result || "REVIEW").toUpperCase()}`;
  if (event.kind === "settle") return "SETTLEMENT RECORDED";
  return event.kind.toUpperCase();
}

function TaskRoute({ task }: { task: PortTask }) {
  const current = stationIndex(task.state);
  return (
    <ol className="ptx-route" aria-label={`Task status: ${STATE_LABEL[task.state]}`}>
      {ROUTE_STATIONS.map((station, index) => (
        <li
          key={station}
          className={index < current ? "passed" : index === current ? "current" : ""}
        >
          <i>{String(index + 1).padStart(2, "0")}</i>
          <span>{STATE_LABEL[station]}</span>
        </li>
      ))}
    </ol>
  );
}

export default function HumanTaskDetail({
  task,
  identity,
  wallet,
  workerWallet,
  walletReady,
  onAct,
  onNeedIdentity,
  onConnectWallet,
  onLinkWallet,
  onOpenRecord,
  onClose,
}: {
  task: PortTask;
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  workerWallet: PortWalletLink | null;
  walletReady: boolean;
  onAct: (action: TaskAction) => void;
  onNeedIdentity: () => void;
  onConnectWallet: () => void;
  onLinkWallet: () => void;
  onOpenRecord: (post: MusePost) => void;
  onClose: () => void;
}) {
  const [proofValues, setProofValues] = useState(() =>
    task.proofRequired.map((item) => ({ type: item.type, value: "" })),
  );
  const [verificationNote, setVerificationNote] = useState("");
  const [settlement, setSettlement] = useState({
    amount: task.reward === null ? "" : String(task.reward),
    asset: task.asset,
    rail: "DIRECT TO WORKER WALLET",
    tx: "",
  });
  const mine = identity?.museId || "";
  const creator = mine === task.creator.museId;
  const assigned = mine && task.assigned?.museId === mine;
  const candidate = task.candidates.some((actor) => actor.museId === mine);
  const canProof = assigned && ["ASSIGNED", "DEPARTED", "ON_SITE"].includes(task.state);
  const paymentDue = task.state === "COMPLETE" && !task.settlement;
  const humanGate = () => {
    if (!identity) return onNeedIdentity();
    if (!wallet) return onConnectWallet();
    if (!walletReady) return onLinkWallet();
    return true;
  };
  const proofComplete = proofValues.length > 0 && proofValues.every((item) => item.value.trim());
  const workerAddress = workerWallet?.address || (assigned ? wallet?.address : "") || "";
  const eventPosts = useMemo(
    () => [task.record, ...task.events.map((event) => event.post)],
    [task],
  );

  return (
    <article className="ptx-detail" aria-label={`Work order ${task.ref}`}>
      <header className="ptx-detail-head">
        <div>
          <span>{task.ref}</span>
          <b>{task.category}</b>
        </div>
        <button onClick={onClose} aria-label="Close work order">CLOSE ×</button>
      </header>

      <section className="ptx-title">
        <div>
          <span>{placeOf(task)}</span>
          <h2>{task.title}</h2>
        </div>
        <strong>{formatReward(task)}</strong>
      </section>

      <TaskRoute task={task} />

      <div className="ptx-detail-scroll">
        <section className="ptx-brief">
          <span>SUCCESS CONDITION</span>
          <p>{task.objective || "The creator did not publish a detailed objective."}</p>
          <dl>
            <div><dt>DEADLINE</dt><dd>{dateTime(task.deadline)}</dd></div>
            <div><dt>DURATION</dt><dd>{task.duration || "UNDECLARED"}</dd></div>
            <div><dt>CLEARANCE</dt><dd>{task.clearance}</dd></div>
            <div><dt>CREATOR</dt><dd>{task.creator.name}</dd></div>
          </dl>
        </section>

        <section className="ptx-proof-spec">
          <header>
            <span>PROOF CONTRACT</span>
            <b>{String(task.proofRequired.length).padStart(2, "0")} ITEMS</b>
          </header>
          {task.proofRequired.length ? (
            <ol>
              {task.proofRequired.map((requirement) => (
                <li key={requirement.index}>
                  <i>{String(requirement.index).padStart(2, "0")}</i>
                  <b>{requirement.type}</b>
                  <p>{requirement.description}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ptx-caution">No proof requirement was published. Claim only if the completion condition is unambiguous.</p>
          )}
        </section>

        {!creator && !assigned && !candidate && ["OPEN", "MATCHING"].includes(task.state) && (
          <section className="ptx-action-block take">
            <span>HUMAN ACTION</span>
            <h3>Take this route.</h3>
            <p>Your PORT signing identity enters the candidate list. Your connected wallet is where the creator can settle after accepted proof.</p>
            <div className="ptx-readiness">
              <span className={identity ? "ready" : ""}><i /> PORT SIGNER</span>
              <span className={wallet ? "ready" : ""}><i /> WALLET CONNECTED</span>
              <span className={walletReady ? "ready" : ""}><i /> LINK ON RECORD</span>
            </div>
            <button
              className="ptx-primary"
              onClick={() => {
                if (humanGate() === true) onAct({ draft: renderAcceptRecord(task), replyTo: task.record });
              }}
            >
              {!identity
                ? "ESTABLISH HUMAN ID"
                : !wallet
                  ? "CONNECT WALLET"
                  : !walletReady
                    ? "PUBLISH WALLET LINK"
                    : "CLAIM THIS TASK"}
            </button>
          </section>
        )}

        {candidate && !assigned && (
          <section className="ptx-action-block waiting">
            <span>CANDIDACY FILED</span>
            <h3>Waiting for assignment.</h3>
            <p>The Muse can review all candidates and establish one route. Do not travel until the assignment record appears here.</p>
          </section>
        )}

        {creator && task.candidates.length > 0 && !task.assigned && (
          <section className="ptx-action-block candidates">
            <span>ASSIGNMENT DESK</span>
            <h3>{task.candidates.length} human{task.candidates.length === 1 ? "" : "s"} ready.</h3>
            <ol>
              {task.candidates.map((human) => (
                <li key={human.museId}>
                  <span>
                    <b>{human.name}</b>
                    <small>{portId(human.museId, "H")}</small>
                  </span>
                  <button onClick={() => onAct({ draft: renderAssignRecord(task, human), replyTo: task.record })}>
                    ASSIGN ROUTE
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {assigned && task.state === "ASSIGNED" && (
          <section className="ptx-action-block">
            <span>ROUTE ESTABLISHED</span>
            <h3>Signal before you move.</h3>
            <p>Only mark departure when you are actually beginning travel or physical execution.</p>
            <button className="ptx-primary" onClick={() => onAct({ draft: renderDepartedRecord(task), replyTo: task.record })}>
              MARK DEPARTED
            </button>
          </section>
        )}

        {assigned && task.state === "DEPARTED" && (
          <section className="ptx-action-block">
            <span>ARRIVAL CHECK</span>
            <h3>Are you on site?</h3>
            <p>This timestamp becomes part of the signed public work history.</p>
            <button className="ptx-primary" onClick={() => onAct({ draft: renderOnSiteRecord(task), replyTo: task.record })}>
              MARK ON SITE
            </button>
          </section>
        )}

        {canProof && (
          <section className="ptx-action-block proof-entry">
            <span>PROOF RETURN</span>
            <h3>Close the physical loop.</h3>
            <p>Publish URLs, receipt references, measurements, or concise answers. Never put private addresses or credentials in proof.</p>
            {proofValues.map((item, index) => (
              <label key={index}>
                <b>{item.type}</b>
                <span>{task.proofRequired[index]?.description || "Completion evidence"}</span>
                <input
                  value={item.value}
                  onChange={(event) =>
                    setProofValues((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, value: event.target.value } : value,
                      ),
                    )
                  }
                  placeholder="Public URL, reference, measurement, or answer"
                />
              </label>
            ))}
            <button
              className="ptx-primary"
              disabled={!proofComplete}
              onClick={() => onAct({ draft: renderProofRecord(task, proofValues), replyTo: task.record })}
            >
              REVIEW + SUBMIT PROOF
            </button>
          </section>
        )}

        {creator && task.proof && ["PROOF_SUBMITTED", "VERIFYING"].includes(task.state) && (
          <section className="ptx-action-block verify">
            <span>CREATOR VERIFICATION</span>
            <h3>Inspect the return.</h3>
            <ol>
              {task.proof.items.map((item) => (
                <li key={item.index}><b>{String(item.index).padStart(2, "0")} / {item.type}</b><p>{item.value}</p></li>
              ))}
            </ol>
            <label>
              VERIFICATION NOTE
              <textarea value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} rows={3} />
            </label>
            <div>
              <button onClick={() => onAct({ draft: renderVerifyRecord(task, "reviewing", verificationNote), replyTo: task.record })}>
                NEEDS REVIEW
              </button>
              <button onClick={() => onAct({ draft: renderVerifyRecord(task, "rejected", verificationNote), replyTo: task.record })}>
                REJECT
              </button>
              <button className="ptx-primary" onClick={() => onAct({ draft: renderVerifyRecord(task, "accepted", verificationNote), replyTo: task.record })}>
                ACCEPT PROOF
              </button>
            </div>
          </section>
        )}

        {creator && paymentDue && (
          <section className="ptx-action-block settlement">
            <span>PAYMENT DUE</span>
            <h3>Settle outside PORT. Record it here.</h3>
            <p>PORT does not custody or send funds. Pay the assigned human using the published address, then attach the real transaction or accounting reference.</p>
            <div className="ptx-payee">
              <span>RECIPIENT WALLET</span>
              <b>{workerAddress ? shortAddress(workerAddress) : "NO PUBLIC WALLET LINK"}</b>
              {workerWallet && <small>{chainLabel(workerWallet.chainId)} · DECLARED BY {workerWallet.actor.name}</small>}
            </div>
            <div className="ptx-settlement-fields">
              <label>AMOUNT<input value={settlement.amount} onChange={(event) => setSettlement({ ...settlement, amount: event.target.value })} /></label>
              <label>ASSET<input value={settlement.asset} onChange={(event) => setSettlement({ ...settlement, asset: event.target.value.toUpperCase() })} /></label>
              <label>PAYMENT RAIL<input value={settlement.rail} onChange={(event) => setSettlement({ ...settlement, rail: event.target.value })} /></label>
              <label className="wide">TRANSACTION / RECEIPT REFERENCE<input value={settlement.tx} onChange={(event) => setSettlement({ ...settlement, tx: event.target.value })} placeholder="Required real external reference" /></label>
            </div>
            <button
              className="ptx-primary"
              disabled={!settlement.amount.trim() || !settlement.asset.trim() || !settlement.tx.trim()}
              onClick={() =>
                onAct({
                  draft: renderSettleRecord(task, { ...settlement, recipient: workerAddress }),
                  replyTo: task.record,
                })
              }
            >
              RECORD EXTERNAL SETTLEMENT
            </button>
          </section>
        )}

        {task.settlement && (
          <section className="ptx-action-block settled">
            <span>SETTLEMENT RECORD</span>
            <h3>{task.settlement.amount ?? "—"} {task.settlement.asset}</h3>
            <dl>
              <div><dt>RAIL</dt><dd>{task.settlement.rail || "UNDECLARED"}</dd></div>
              <div><dt>REFERENCE</dt><dd>{task.settlement.tx || "NONE"}</dd></div>
              <div><dt>RECIPIENT</dt><dd>{task.settlement.recipient ? shortAddress(task.settlement.recipient) : "UNDECLARED"}</dd></div>
            </dl>
            <p>Creator-signed external payment record. PORT does not independently verify chain finality or custody funds.</p>
          </section>
        )}

        <section className="ptx-ledger">
          <header><span>PUBLIC ROUTE LEDGER</span><b>{eventPosts.length} RECORDS</b></header>
          <ol>
            {eventPosts.map((post, index) => (
              <li key={post.id}>
                <time>{clockOf(new Date(post.created_at).getTime())}</time>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span><b>{post.name}</b><small>{eventLabel(task, index)}</small></span>
                <button onClick={() => onOpenRecord(post)}>OPEN RECORD</button>
              </li>
            ))}
          </ol>
        </section>

        {creator && !task.proof && !["CANCELLED", "SETTLED", "DISPUTED", "EXPIRED"].includes(task.state) && (
          <button className="ptx-cancel" onClick={() => onAct({ draft: renderCancelRecord(task, "Cancelled by creator"), replyTo: task.record })}>
            CANCEL WORK ORDER
          </button>
        )}
      </div>
    </article>
  );
}
