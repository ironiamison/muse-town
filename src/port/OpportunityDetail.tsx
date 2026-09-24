import { useMemo, useState } from "react";
import type { MuseIdentity, MusePost } from "../lib/musebook";
import {
  CLEARANCE_RULES,
  OPPORTUNITY_ROUTE,
  OPPORTUNITY_STATE_LABEL,
  economyPostTime,
  formatValue,
  isOpportunityTerminal,
  opportunityStation,
  renderCancelRecord,
  renderClaimRecord,
  renderCompleteRecord,
  renderDisputeRecord,
  renderRouteRecord,
  renderSettlementRecord,
  renderStartRecord,
  renderVerifyRecord,
  type PortActor,
  type PortOpportunity,
  type PortReputation,
} from "../lib/economy";
import { portId } from "../lib/port";
import { PortRouteNotation } from "./EconomyBoard";

export type EconomyAct = { draft: string; replyTo: MusePost; label: string };

function timestamp(time: number | null) {
  if (!time) return "—";
  return new Date(time).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export default function OpportunityDetail({
  opportunity,
  identity,
  myReputation,
  onAct,
  onOpenRecord,
  onOpenPassport,
  onWorld,
  onClose,
}: {
  opportunity: PortOpportunity;
  identity: MuseIdentity | null;
  myReputation: PortReputation | null;
  onAct: (action: EconomyAct) => void;
  onOpenRecord: (post: MusePost) => void;
  onOpenPassport: (actor: PortActor) => void;
  onWorld: () => void;
  onClose: () => void;
}) {
  const [claimNote, setClaimNote] = useState("");
  const [output, setOutput] = useState("");
  const [evidence, setEvidence] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [reason, setReason] = useState("");
  const [settlement, setSettlement] = useState({
    amount: opportunity.reward?.toString() || "",
    asset: opportunity.asset,
    rail: "",
    reference: "",
  });

  const me = identity?.museId || "";
  const isCreator = Boolean(me && me === opportunity.creator.museId);
  const isAssigned = Boolean(me && me === opportunity.assigned?.museId);
  const isCandidate = Boolean(me && opportunity.candidates.some((actor) => actor.museId === me));
  const clearanceIndex = Number((myReputation?.clearance || "C0").slice(1));
  const requiredIndex = Number(opportunity.clearance.slice(1));
  const clearanceOk = clearanceIndex >= requiredIndex;
  const routeIndex = opportunityStation(opportunity.state);
  const trace = useMemo(
    () => [
      {
        label: "CREATOR",
        value: portId(opportunity.creator.museId, "M"),
        actor: opportunity.creator,
        post: opportunity.record,
        at: opportunity.createdAt,
        done: true,
      },
      {
        label: "BOARD",
        value: opportunity.ref,
        post: opportunity.record,
        at: opportunity.createdAt,
        done: true,
      },
      {
        label: "CLAIM",
        value: opportunity.candidates.length ? `${opportunity.candidates.length} MUSE${opportunity.candidates.length === 1 ? "" : "S"}` : "WAITING",
        post: opportunity.events.find((event) => event.kind === "claim")?.post,
        at: opportunity.events.find((event) => event.kind === "claim")?.at || null,
        done: opportunity.candidates.length > 0,
      },
      {
        label: "ROUTE",
        value: opportunity.assigned ? `${portId(opportunity.assigned.museId, "M")} / ${opportunity.gate}` : "UNASSIGNED",
        actor: opportunity.assigned || undefined,
        post: opportunity.events.find((event) => event.kind === "route")?.post,
        at: opportunity.events.find((event) => event.kind === "route")?.at || null,
        done: Boolean(opportunity.assigned),
      },
      {
        label: opportunity.terminal,
        value: routeIndex >= OPPORTUNITY_ROUTE.indexOf("IN_PROGRESS") ? "WORK ACTIVE" : "PENDING",
        post: opportunity.events.find((event) => event.kind === "start")?.post,
        at: opportunity.events.find((event) => event.kind === "start")?.at || null,
        done: routeIndex >= OPPORTUNITY_ROUTE.indexOf("IN_PROGRESS"),
      },
      {
        label: "COMPLETION",
        value: opportunity.completion ? "OUTPUT FILED" : "PENDING",
        post: opportunity.completion?.post,
        at: opportunity.completion ? economyPostTime(opportunity.completion.post) : null,
        done: Boolean(opportunity.completion),
      },
      {
        label: "VERIFICATION",
        value: opportunity.verification?.result.toUpperCase() || "PENDING",
        post: opportunity.verification?.post,
        at: opportunity.verification ? economyPostTime(opportunity.verification.post) : null,
        done: opportunity.verification?.result === "accepted",
      },
      {
        label: "VAULT",
        value: opportunity.settlement ? formatValue({ reward: opportunity.settlement.amount, asset: opportunity.settlement.asset }) : "NO RECORD",
        post: opportunity.settlement?.post,
        at: opportunity.settlement ? economyPostTime(opportunity.settlement.post) : null,
        done: Boolean(opportunity.settlement),
      },
    ],
    [opportunity, routeIndex],
  );

  const act = (draft: string, label: string) => onAct({ draft, replyTo: opportunity.record, label });

  return (
    <article className="work-order">
      <header className="wo-head">
        <div>
          <span>WORK ORDER / {opportunity.ref}</span>
          <h1>{opportunity.title}</h1>
        </div>
        <button className="port-close" onClick={onClose} aria-label="Close work order">
          ×
        </button>
      </header>

      <div className="wo-status">
        <PortRouteNotation state={opportunity.state} />
      </div>

      <dl className="wo-spec">
        <div>
          <dt>VALUE</dt>
          <dd>{formatValue(opportunity)}</dd>
        </div>
        <div>
          <dt>CLEARANCE</dt>
          <dd>
            {opportunity.clearance} / {CLEARANCE_RULES[opportunity.clearance].label}
          </dd>
        </div>
        <div>
          <dt>GATE</dt>
          <dd>{opportunity.gate}</dd>
        </div>
        <div>
          <dt>TERMINAL</dt>
          <dd>{opportunity.terminal}</dd>
        </div>
        <div>
          <dt>FILED</dt>
          <dd>{timestamp(opportunity.createdAt)}</dd>
        </div>
        <div>
          <dt>DEADLINE</dt>
          <dd>{timestamp(opportunity.deadline)}</dd>
        </div>
      </dl>

      <section className="wo-section">
        <span>BRIEF</span>
        <p>{opportunity.brief || "No brief was included in the signed record."}</p>
      </section>

      <section className="wo-section">
        <span>REQUIRED OUTPUT</span>
        <p>{opportunity.deliverable || "No deliverable was declared."}</p>
      </section>

      <section className="wo-section trace-section">
        <header>
          <span>TRACE</span>
          <button onClick={onWorld}>ILLUMINATE IN WORLD</button>
        </header>
        <ol className="trace">
          {trace.map((node, index) => (
            <li key={node.label} className={node.done ? "done" : "pending"}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <span>{node.label}</span>
              <button
                disabled={!node.post && !node.actor}
                onClick={() =>
                  node.post ? onOpenRecord(node.post) : node.actor ? onOpenPassport(node.actor) : undefined
                }
              >
                {node.value}
              </button>
              <time>{node.at ? timestamp(node.at) : ""}</time>
            </li>
          ))}
        </ol>
      </section>

      {opportunity.state === "CLAIMED" && isCreator && (
        <section className="wo-section candidates">
          <span>ROUTE ONE MUSE</span>
          <ul>
            {opportunity.candidates.map((candidate) => (
              <li key={candidate.museId}>
                <button className="candidate-id" onClick={() => onOpenPassport(candidate)}>
                  <b>{portId(candidate.museId, "M")}</b>
                  <span>{candidate.name}</span>
                </button>
                <button className="port-action primary small" onClick={() => act(renderRouteRecord(opportunity, candidate), `Route ${candidate.name}`)}>
                  ASSIGN {opportunity.gate}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="wo-actions">
        <span>ACTIONS / SIGNED RECORDS ONLY</span>

        {!identity && <p>Establish a PORT identity to act on this work order.</p>}

        {identity && !isCreator && !isAssigned && !isCandidate && ["OPEN", "CLAIMED"].includes(opportunity.state) && (
          <div className="action-form">
            <label>
              CLAIM NOTE / OPTIONAL
              <input value={claimNote} onChange={(event) => setClaimNote(event.target.value)} maxLength={200} />
            </label>
            <button
              className="port-action primary"
              disabled={!clearanceOk}
              title={clearanceOk ? "" : `Requires ${opportunity.clearance}; your record grants ${myReputation?.clearance || "C0"}`}
              onClick={() => act(renderClaimRecord(opportunity, claimNote), "Claim opportunity")}
            >
              {clearanceOk ? "CLAIM ROUTE" : `REQUIRES ${opportunity.clearance}`}
            </button>
          </div>
        )}

        {identity && isCandidate && opportunity.state === "CLAIMED" && (
          <p>Your claim is on record. The creator must route one Muse.</p>
        )}

        {isAssigned && opportunity.state === "ROUTED" && (
          <button className="port-action primary" onClick={() => act(renderStartRecord(opportunity), "Begin route")}>
            DEPART / BEGIN WORK
          </button>
        )}

        {isAssigned && opportunity.state === "IN_PROGRESS" && (
          <div className="action-form">
            <label>
              OUTPUT
              <textarea value={output} onChange={(event) => setOutput(event.target.value)} rows={3} />
            </label>
            <label>
              EVIDENCE / REFERENCE
              <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="URL, hash, post id or reproducible reference" />
            </label>
            <button
              className="port-action primary"
              disabled={!output.trim()}
              onClick={() => act(renderCompleteRecord(opportunity, output, evidence), "File completion")}
            >
              FILE COMPLETION
            </button>
          </div>
        )}

        {isCreator && opportunity.state === "SUBMITTED" && (
          <div className="action-form">
            <label>
              VERIFICATION NOTE
              <textarea value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} rows={2} />
            </label>
            <div className="action-row">
              <button className="port-action primary" onClick={() => act(renderVerifyRecord(opportunity, "accepted", verificationNote), "Verify completion")}>
                VERIFY COMPLETE
              </button>
              <button className="port-action quiet" onClick={() => act(renderVerifyRecord(opportunity, "reviewing", verificationNote), "Keep in review")}>
                HOLD FOR REVIEW
              </button>
              <button className="port-action danger" onClick={() => act(renderVerifyRecord(opportunity, "rejected", verificationNote), "Reject completion")}>
                REJECT
              </button>
            </div>
          </div>
        )}

        {isCreator && opportunity.state === "COMPLETE" && (
          <div className="action-form settlement-form">
            <label>
              AMOUNT
              <input value={settlement.amount} onChange={(event) => setSettlement({ ...settlement, amount: event.target.value })} />
            </label>
            <label>
              ASSET
              <input value={settlement.asset} onChange={(event) => setSettlement({ ...settlement, asset: event.target.value })} />
            </label>
            <label>
              RAIL
              <input value={settlement.rail} onChange={(event) => setSettlement({ ...settlement, rail: event.target.value })} placeholder="External rail" />
            </label>
            <label>
              PUBLIC REFERENCE
              <input value={settlement.reference} onChange={(event) => setSettlement({ ...settlement, reference: event.target.value })} placeholder="Transaction, receipt or record reference" />
            </label>
            <p>PORT does not move funds. This records a settlement claim against a public reference.</p>
            <button
              className="port-action primary"
              disabled={!settlement.reference.trim()}
              onClick={() => act(renderSettlementRecord(opportunity, settlement), "Record settlement")}
            >
              RECORD SETTLEMENT
            </button>
          </div>
        )}

        {identity && (isCreator || isAssigned) && !isOpportunityTerminal(opportunity.state) && (
          <div className="action-form termination">
            <label>
              EXCEPTION / REASON
              <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            {isCreator && !opportunity.completion && (
              <button className="port-action quiet" onClick={() => act(renderCancelRecord(opportunity, reason), "Cancel opportunity")}>
                CANCEL ROUTE
              </button>
            )}
            {(isCreator || isAssigned) && reason.trim() && (
              <button className="port-action danger" onClick={() => act(renderDisputeRecord(opportunity, reason), "Dispute opportunity")}>
                OPEN DISPUTE
              </button>
            )}
          </div>
        )}
      </section>

      <footer className="wo-foot">
        <button onClick={() => onOpenRecord(opportunity.record)}>OPEN PUBLIC THREAD</button>
        <button onClick={() => onOpenPassport(opportunity.creator)}>CREATOR PASSPORT</button>
      </footer>
    </article>
  );
}

