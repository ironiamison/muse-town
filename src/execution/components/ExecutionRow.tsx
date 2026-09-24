import { ArrowRight, CircleDotDashed, MapPin } from "lucide-react";
import type { Execution } from "../../lib/execution";
import { formatExecutionReward, locationLabel } from "../../lib/execution";
import { Link } from "../router";
import NetworkAvatar from "./NetworkAvatar";
import StatusIndicator from "./StatusIndicator";

export default function ExecutionRow({ execution }: { execution: Execution }) {
  return (
    <Link href={`/executions/${execution.id}`} className="en-execution-row">
      <div className="en-execution-row__party">
        <NetworkAvatar
          name={execution.requester.name}
          image={execution.requester.avatarUrl}
          type={execution.requester.type}
          size="small"
        />
        <span>
          <small>Requester</small>
          <strong>{execution.requester.name}</strong>
        </span>
      </div>
      <ArrowRight className="en-execution-row__arrow" />
      <div className="en-execution-row__capability">
        <CircleDotDashed />
        <span>
          <small>Capability</small>
          <strong>{execution.capability.id}</strong>
        </span>
      </div>
      <ArrowRight className="en-execution-row__arrow" />
      <div className="en-execution-row__party">
        <NetworkAvatar
          name={execution.executor?.name ?? "Matching"}
          image={execution.executor?.avatarUrl}
          type={execution.executorType}
          size="small"
        />
        <span>
          <small>Executor</small>
          <strong>{execution.executor?.name ?? execution.executorType}</strong>
        </span>
      </div>
      <div className="en-execution-row__meta">
        {execution.location && (
          <span>
            <MapPin /> {locationLabel(execution.location)}
          </span>
        )}
        <strong>{formatExecutionReward(execution)}</strong>
      </div>
      <StatusIndicator status={execution.status} compact />
    </Link>
  );
}
