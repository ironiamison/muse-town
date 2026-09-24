import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleEllipsis,
  ScanSearch,
} from "lucide-react";
import type { Execution } from "../../lib/execution";
import NetworkAvatar from "./NetworkAvatar";
import StatusIndicator from "./StatusIndicator";

function Connector() {
  return (
    <span className="en-flow__connector" aria-hidden="true">
      <ArrowRight className="en-flow__arrow-horizontal" />
      <ArrowDown className="en-flow__arrow-vertical" />
      <i />
    </span>
  );
}

export default function ExecutionFlow({
  execution,
  emphasis = false,
}: {
  execution: Execution;
  emphasis?: boolean;
}) {
  const resultReady = execution.status === "COMPLETE";
  return (
    <article className={`en-flow ${emphasis ? "en-flow--emphasis" : ""}`}>
      <div className="en-flow__topline">
        <StatusIndicator status={execution.status} compact />
        <span>{execution.id}</span>
      </div>
      <div className="en-flow__rail" aria-label="Execution route">
        <div className="en-flow__node">
          <NetworkAvatar
            name={execution.requester.name}
            image={execution.requester.avatarUrl}
            type={execution.requester.type}
            size={emphasis ? "large" : "medium"}
          />
          <span>
            <small>Requester</small>
            <strong>{execution.requester.name}</strong>
            <em>{execution.requester.type}</em>
          </span>
        </div>
        <Connector />
        <div className="en-flow__node en-flow__capability">
          <span className="en-flow__capability-icon">
            <ScanSearch aria-hidden="true" />
          </span>
          <span>
            <small>Capability</small>
            <strong>{execution.capability.name}</strong>
            <em>{execution.capability.id}</em>
          </span>
        </div>
        <Connector />
        <div className="en-flow__node">
          <NetworkAvatar
            name={execution.executor?.name ?? "Matching"}
            image={execution.executor?.avatarUrl}
            type={execution.executorType}
            size={emphasis ? "large" : "medium"}
          />
          <span>
            <small>Executor</small>
            <strong>{execution.executor?.name ?? "Searching network"}</strong>
            <em>{execution.executor ? execution.executor.type : execution.executorType}</em>
          </span>
        </div>
        <Connector />
        <div className={`en-flow__result ${resultReady ? "is-ready" : ""}`}>
          {resultReady ? <Check aria-hidden="true" /> : <CircleEllipsis aria-hidden="true" />}
          <span>
            <small>Result</small>
            <strong>{resultReady ? "Delivered" : "Pending"}</strong>
          </span>
        </div>
      </div>
      <div className="en-flow__summary">
        <strong>{execution.title}</strong>
        <span>{execution.instructions}</span>
      </div>
    </article>
  );
}
