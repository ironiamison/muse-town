import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import type { Executor } from "../../lib/execution";
import NetworkAvatar from "./NetworkAvatar";

function percent(value: number | null) {
  return value === null ? "Not enough history" : `${Math.round(value * 100)}%`;
}

export default function ExecutorProfile({
  executor,
  condensed = false,
}: {
  executor: Executor;
  condensed?: boolean;
}) {
  return (
    <article className={`en-executor ${condensed ? "is-condensed" : ""}`}>
      <header>
        <NetworkAvatar
          name={executor.name}
          image={executor.avatarUrl}
          type={executor.type}
          size={condensed ? "medium" : "large"}
        />
        <div>
          <small>{executor.type} executor</small>
          <h3>{executor.name}</h3>
          <span className={`en-executor__availability is-${executor.availability}`}>
            <i />
            {executor.availability}
          </span>
        </div>
      </header>
      <div className="en-executor__facts">
        <span>
          <CheckCircle2 />
          <strong>{executor.reputation.executionsCompleted}</strong>
          completed
        </span>
        <span>
          <ShieldCheck />
          <strong>{percent(executor.reputation.successRate)}</strong>
          success
        </span>
        {!condensed && (
          <span>
            <Clock3 />
            <strong>
              {executor.reputation.averageResponseTime
                ? `${executor.reputation.averageResponseTime}m`
                : "—"}
            </strong>
            response
          </span>
        )}
      </div>
      {!condensed && (
        <>
          <div className="en-executor__locations">
            <MapPin aria-hidden="true" />
            {executor.locations.length
              ? executor.locations.join(" · ")
              : "No location declared"}
          </div>
          <div className="en-executor__skills">
            {executor.capabilities.map((capability) => (
              <code key={capability}>{capability}</code>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
