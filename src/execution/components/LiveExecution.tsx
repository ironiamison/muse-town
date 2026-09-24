import { ArrowRight, Radio, RefreshCw } from "lucide-react";
import type { Execution } from "../../lib/execution";
import { formatExecutionReward, locationLabel } from "../../lib/execution";
import { Link } from "../router";
import ExecutionFlow from "./ExecutionFlow";

export default function LiveExecution({
  execution,
  loading,
  offline,
}: {
  execution: Execution | null;
  loading: boolean;
  offline: boolean;
}) {
  return (
    <section className="en-live" aria-label="Live execution">
      <header className="en-live__header">
        <span>
          <Radio aria-hidden="true" />
          Live execution
        </span>
        <small>{offline ? "Upstream unavailable" : loading ? "Syncing" : "Signed records"}</small>
      </header>
      {execution ? (
        <>
          <ExecutionFlow execution={execution} emphasis />
          <footer className="en-live__footer">
            <span>
              {locationLabel(execution.location)} · {formatExecutionReward(execution)}
            </span>
            <Link href={`/executions/${execution.id}`}>
              Open execution <ArrowRight aria-hidden="true" />
            </Link>
          </footer>
        </>
      ) : (
        <div className="en-live__empty">
          {loading ? (
            <RefreshCw className="is-spinning" aria-hidden="true" />
          ) : (
            <Radio aria-hidden="true" />
          )}
          <div>
            <strong>{loading ? "Reading the network" : "No public execution is active"}</strong>
            <p>
              {offline
                ? "Musebook could not be reached. No activity has been invented."
                : "This panel fills only when a signed task exists. The network is ready for the first request."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
