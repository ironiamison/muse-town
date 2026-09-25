import { ExternalLink } from "lucide-react";
import { buildProofCapsule, standingLabel } from "../../lib/proof-capsule";
import type { Execution } from "../../lib/execution";
import type { PortTask } from "../../lib/port";

/**
 * The capsule that returns to the Muse: what came back, what each check
 * guarantees, and what it does not. Renders over existing proof data only.
 */
export default function ProofCapsuleView({ execution, task }: { execution: Execution; task: PortTask | null }) {
  const capsule = buildProofCapsule(execution, task);
  const returnedTo = execution.requester.name;

  return (
    <section className="ms-capsule" aria-label="Proof capsule">
      <header className="ms-capsule__head">
        <div>
          <span className="ms-eyebrow">Proof capsule</span>
          <h2>Returned to {returnedTo}</h2>
        </div>
        <a href={capsule.recordUrl} target="_blank" rel="noreferrer" className="ms-capsule__record">
          Signed record <ExternalLink aria-hidden="true" />
        </a>
      </header>

      {capsule.finding && (
        <p className="ms-capsule__finding">{capsule.finding}</p>
      )}

      <ol className="ms-capsule__checks">
        {capsule.checks
          .filter((check) => check.standing !== "not_applicable")
          .map((check) => (
            <li key={check.id} data-standing={check.standing}>
              <b>{standingLabel(check.standing)}</b>
              <span>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </span>
            </li>
          ))}
      </ol>

      {capsule.missing.length > 0 && (
        <p className="ms-capsule__missing">
          Not yet returned: {capsule.missing.map((item) => String(item.type).toLowerCase()).join(", ")}.
        </p>
      )}

      <p className="ms-capsule__boundary">{capsule.boundary}</p>
    </section>
  );
}
