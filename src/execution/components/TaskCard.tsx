import { ArrowRight, Clock3, MapPin } from "lucide-react";
import type { Execution } from "../../lib/execution";
import {
  formatExecutionReward,
  locationLabel,
} from "../../lib/execution";
import { Link } from "../router";
import NetworkAvatar from "./NetworkAvatar";
import StatusIndicator from "./StatusIndicator";

export default function TaskCard({
  execution,
  compact = false,
  onOpen,
}: {
  execution: Execution;
  compact?: boolean;
  onOpen?: (execution: Execution) => void;
}) {
  const href = `/tasks/${execution.id}`;
  return (
    <article className={`en-task-card ${compact ? "is-compact" : ""}`}>
      <header>
        <div className="en-task-card__requester">
          <NetworkAvatar
            name={execution.requester.name}
            image={execution.requester.avatarUrl}
            type={execution.requester.type}
          />
          <span>
            <small>Requested by Muse</small>
            <strong>{execution.requester.name}</strong>
          </span>
        </div>
        <StatusIndicator status={execution.status} compact />
      </header>
      <div className="en-task-card__body">
        <small>Task · {execution.capability.name}</small>
        <h3>{execution.title}</h3>
        {!compact && <p>{execution.instructions}</p>}
        <div className="en-task-card__facts">
          <span>
            <MapPin aria-hidden="true" />
            <i>Location</i>
            <strong>{locationLabel(execution.location)}</strong>
          </span>
          <span>
            <Clock3 aria-hidden="true" />
            <i>Time</i>
            <strong>{execution.capability.estimatedDuration}</strong>
          </span>
          <span>
            <i>Proof</i>
            <strong>
              {execution.proofRequirements.length
                ? execution.proofRequirements
                    .map((proof) => String(proof.type).toLowerCase())
                    .join(" · ")
                : "Not specified"}
            </strong>
          </span>
        </div>
      </div>
      <footer>
        <span><small>Reward</small><strong>{formatExecutionReward(execution)}</strong></span>
        <Link
          href={href}
          onClick={() => onOpen?.(execution)}
          ariaLabel={`View ${execution.title}`}
        >
          {execution.status === "CREATED" || execution.status === "MATCHING"
            ? "Claim task"
            : "View execution"}
          <ArrowRight aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}
