import type { ExecutionStatus } from "../../lib/execution";

const labels: Record<ExecutionStatus, string> = {
  CREATED: "Open",
  MATCHING: "Searching",
  CLAIMED: "Claimed",
  IN_PROGRESS: "In progress",
  PROOF_SUBMITTED: "Proof submitted",
  VERIFYING: "Verifying",
  COMPLETE: "Complete",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export default function StatusIndicator({
  status,
  compact = false,
}: {
  status: ExecutionStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={`en-status en-status--${status.toLowerCase()} ${compact ? "is-compact" : ""}`}
    >
      <i aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
