import type { Execution, ExecutionProof } from "./execution.js";
import type { PortTask } from "./port.js";

/**
 * A ProofCapsule is the single object that returns to the Muse after an
 * external execution. It wraps the signed record, the evidence items, and an
 * explicit statement of what each check does and does not guarantee.
 *
 * Nothing here upgrades a claim to a verification. Every check states its
 * standing truthfully so the Muse (and its owner) can decide how much to trust it.
 */
export type CheckStanding = "verified" | "signed" | "claimed" | "missing" | "not_applicable";

export type CapsuleCheck = {
  id: "signature" | "timestamp" | "location" | "media" | "identifier" | "acceptance" | "payment";
  label: string;
  standing: CheckStanding;
  detail: string;
};

export type CapsuleItem = ExecutionProof & {
  kind: "image" | "video" | "location" | "receipt" | "answer" | "document" | "signature" | "other";
  isLink: boolean;
};

export type ProofCapsule = {
  executionId: string;
  title: string;
  status: Execution["status"];
  requester: Execution["requester"];
  executor: Execution["executor"];
  submittedAt: number | null;
  verifiedAt: number | null;
  items: CapsuleItem[];
  requirements: Execution["proofRequirements"];
  missing: Execution["proofRequirements"];
  checks: CapsuleCheck[];
  finding: string | null;
  recordUrl: string;
  /** Plain-language guarantee boundary shown with every capsule. */
  boundary: string;
};

function kindOf(type: string): CapsuleItem["kind"] {
  const value = type.toUpperCase();
  if (value === "IMAGE") return "image";
  if (value === "VIDEO") return "video";
  if (value === "LOCATION") return "location";
  if (value === "RECEIPT") return "receipt";
  if (value === "ANSWER" || value === "CONFIRM" || value === "OUTPUT") return "answer";
  if (value === "DOCUMENT" || value === "CODE") return "document";
  if (value === "SIGNATURE") return "signature";
  return "other";
}

export function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function lastEvent(task: PortTask | null, kind: string) {
  if (!task) return null;
  for (let index = task.events.length - 1; index >= 0; index -= 1) {
    if (task.events[index].kind === kind) return task.events[index].at;
  }
  return null;
}

export function buildProofCapsule(execution: Execution, task: PortTask | null = null): ProofCapsule {
  const items: CapsuleItem[] = execution.proof.map((item) => ({
    ...item,
    kind: kindOf(String(item.type)),
    isLink: isPublicUrl(item.value),
  }));
  const submittedAt = lastEvent(task, "proof");
  const verifiedAt = lastEvent(task, "verify");
  const accepted = execution.result?.accepted ?? null;

  const providedTypes = new Set(items.map((item) => String(item.type).toUpperCase()));
  const missing = execution.proofRequirements.filter(
    (requirement) => !providedTypes.has(String(requirement.type).toUpperCase()),
  );

  const hasLocation = items.some((item) => item.kind === "location");
  const hasMedia = items.some((item) => item.kind === "image" || item.kind === "video");
  const hasIdentifier = items.some((item) => item.kind === "answer" || item.kind === "receipt" || item.kind === "signature");

  const checks: CapsuleCheck[] = [
    {
      id: "signature",
      label: "Executor signature",
      standing: items.length ? "signed" : "missing",
      detail: items.length
        ? `Submitted as a Musebook record signed by ${execution.executor?.name ?? "the executor"}'s Ed25519 key.`
        : "No proof record has been signed yet.",
    },
    {
      id: "timestamp",
      label: "Submission time",
      standing: submittedAt ? "signed" : items.length ? "claimed" : "missing",
      detail: submittedAt
        ? `Recorded by Musebook when the proof was published (${new Date(submittedAt).toISOString()}).`
        : "The publication time is not available in this snapshot.",
    },
    {
      id: "location",
      label: "Location",
      standing: hasLocation ? "claimed" : execution.location ? "missing" : "not_applicable",
      detail: hasLocation
        ? "Stated by the executor. Not independently confirmed by device attestation."
        : execution.location
          ? "No location item was returned."
          : "This execution has no physical location.",
    },
    {
      id: "media",
      label: "Original media",
      standing: hasMedia ? "claimed" : "missing",
      detail: hasMedia
        ? "Links to media the executor published. No content hash is recorded in port/1, so tampering cannot be ruled out from the record alone."
        : "No photographs or video were returned.",
    },
    {
      id: "identifier",
      label: "Structured answer",
      standing: hasIdentifier ? "signed" : "missing",
      detail: hasIdentifier
        ? "Answers, receipts, or identifiers are part of the signed proof record."
        : "No structured answer was returned.",
    },
    {
      id: "acceptance",
      label: "Requester review",
      standing: accepted === true ? "verified" : accepted === false ? "claimed" : "missing",
      detail:
        accepted === true
          ? `Accepted by ${execution.requester.name} in a signed verify record.`
          : accepted === false
            ? `Rejected by ${execution.requester.name}: ${execution.result?.note ?? "no note"}.`
            : "The requester has not published a verify record yet.",
    },
    {
      id: "payment",
      label: "Payment",
      standing:
        execution.payment.status === "DECLARED_PAID"
          ? "claimed"
          : execution.payment.status === "NOT_REQUIRED"
            ? "not_applicable"
            : "missing",
      detail:
        execution.payment.status === "DECLARED_PAID"
          ? `Requester-signed external claim of ${execution.payment.amount ?? "—"} ${execution.payment.currency}. Finality is not verified by this network.`
          : execution.payment.status === "NOT_REQUIRED"
            ? "No payment was attached to this request."
            : "No settlement record has been published.",
    },
  ];

  return {
    executionId: execution.id,
    title: execution.title,
    status: execution.status,
    requester: execution.requester,
    executor: execution.executor,
    submittedAt,
    verifiedAt,
    items,
    requirements: execution.proofRequirements,
    missing,
    checks,
    finding: execution.result?.note?.trim() || execution.result?.output?.trim() || null,
    recordUrl: execution.publicRecordUrl,
    boundary:
      "Signatures prove who published each record and that it was not altered afterwards. They do not prove that a scene, location, or claim is true. Review the originals.",
  };
}

export function standingLabel(standing: CheckStanding) {
  switch (standing) {
    case "verified":
      return "Verified";
    case "signed":
      return "Signed";
    case "claimed":
      return "Claimed";
    case "missing":
      return "Missing";
    default:
      return "n/a";
  }
}
