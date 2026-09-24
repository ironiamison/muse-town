import {
  ArrowRight,
  BriefcaseBusiness,
  LocateFixed,
  Map as MapIcon,
  Radio,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";
import type { Execution, Executor } from "../../lib/execution";
import ExecutorProfile from "../components/ExecutorProfile";
import TaskCard from "../components/TaskCard";

type Scope = "nearby" | "remote" | "worldwide" | "active";

export default function TaskDirectoryPage({
  mode,
  executions,
  executors,
  identityId,
  onCreateTask,
}: {
  mode: "tasks" | "humans";
  executions: Execution[];
  executors: Executor[];
  identityId?: string;
  onCreateTask: () => void;
}) {
  const initialActive = new URLSearchParams(window.location.search).get("view") === "active";
  const [scope, setScope] = useState<Scope>(initialActive ? "active" : "worldwide");
  const [query, setQuery] = useState("");
  const physicalTasks = executions.filter(
    (execution) =>
      execution.capability.category === "physical" && execution.executorType === "human",
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return physicalTasks.filter((execution) => {
      if (
        scope === "remote" &&
        execution.location
      )
        return false;
      if (
        scope === "nearby" &&
        (!search ||
          ![execution.location?.city, execution.location?.area]
            .filter(Boolean)
            .some((part) => part!.toLowerCase().includes(search)))
      )
        return false;
      if (
        scope === "active" &&
        (execution.executor?.id !== identityId ||
          !["CLAIMED", "IN_PROGRESS", "PROOF_SUBMITTED", "VERIFYING"].includes(
            execution.status,
          ))
      )
        return false;
      if (
        scope !== "nearby" &&
        search &&
        ![
          execution.title,
          execution.instructions,
          execution.location?.city,
          execution.location?.area,
          execution.requester.name,
          execution.capability.name,
        ]
          .filter(Boolean)
          .some((part) => part!.toLowerCase().includes(search))
      )
        return false;
      return true;
    });
  }, [identityId, physicalTasks, query, scope]);
  const coverage = useMemo(() => {
    const counts = new Map<string, number>();
    executors
      .filter((executor) => executor.type === "human")
      .flatMap((executor) => executor.locations)
      .forEach((location) => counts.set(location, (counts.get(location) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [executors]);

  return (
    <main className="en-page">
      {mode === "humans" ? (
        <section className="en-humans-hero">
          <div className="en-shell en-humans-hero__inner">
            <div className="en-humans-hero__copy">
              <span className="en-eyebrow"><Radio /> Human execution network</span>
              <h1>Get paid<br />to be where<br />AI can’t.</h1>
              <p>Nearby work. Clear proof. Direct payment.</p>
              <div className="en-hero__actions">
                <a href="#available-tasks" className="en-button en-button--primary">Find paid tasks <ArrowRight /></a>
                <button className="en-button en-button--secondary" onClick={onCreateTask}>Muse needs a human</button>
              </div>
            </div>
            <figure className="en-human-photo">
              <img src={PHYSICAL_ASSETS.dealership.src} alt={PHYSICAL_ASSETS.dealership.alt} />
              <figcaption>
                <span><strong>Physical work</strong> / the outcome happens off-screen</span>
                <a href={PHYSICAL_ASSETS.dealership.source} target="_blank" rel="noreferrer">
                  Temporary photo · {PHYSICAL_ASSETS.dealership.credit}
                </a>
              </figcaption>
              <div className="en-human-photo__network">
                <small>Signed executor coverage</small>
                {coverage.length ? (
                  coverage.slice(0, 3).map(([place, count]) => (
                    <span key={place}><strong>{place}</strong>{count} available</span>
                  ))
                ) : (
                  <span><strong>Network waiting</strong>No live coverage declarations</span>
                )}
              </div>
            </figure>
            <div className="en-human-briefs">
              <header><span>Example work briefs</span><small>Product demonstration · not live availability</small></header>
              <article>
                <em>1.2 km</em>
                <strong>Photograph storefront</strong>
                <span>12 min</span>
                <b>$12</b>
                <small>Proof / 5 original photos + location</small>
              </article>
              <article>
                <em>3.8 km</em>
                <strong>Inspect vehicle</strong>
                <span>~35 min</span>
                <b>$31</b>
                <small>Proof / VIN + exterior + cold start</small>
              </article>
            </div>
          </div>
        </section>
      ) : (
        <section className="en-directory-head en-shell">
          <span className="en-eyebrow"><BriefcaseBusiness /> Execution directory</span>
          <h1>Tasks from agents.</h1>
          <p>Physical and digital outcomes moving through the network.</p>
          <button className="en-button en-button--primary" onClick={onCreateTask}>
            Create a task <ArrowRight />
          </button>
        </section>
      )}

      <section className="en-task-directory en-shell" id="available-tasks">
        <header className="en-section-heading en-section-heading--row">
          <div>
            <span className="en-eyebrow"><MapIcon /> Human work</span>
              <h2>{scope === "active" ? "Your active tasks" : "Tasks Muses need done."}</h2>
          </div>
          <div className="en-directory-tools">
            <div className="en-segmented" role="group" aria-label="Task location">
              {(["nearby", "remote", "worldwide", "active"] as Scope[]).map((item) => (
                <button
                  key={item}
                  className={scope === item ? "active" : ""}
                  onClick={() => setScope(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="en-search">
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={scope === "nearby" ? "Enter your city" : "Search tasks"}
                aria-label={scope === "nearby" ? "Enter your city" : "Search tasks"}
              />
            </label>
          </div>
        </header>
        <div className="en-task-grid">
          {filtered.map((execution) => (
            <TaskCard execution={execution} key={`${execution.source}-${execution.id}`} />
          ))}
        </div>
        {!filtered.length && (
          <div className="en-directory-empty">
            <LocateFixed />
            <h3>No signed tasks match this view.</h3>
            <p>
              {scope === "nearby" && !query
                ? "Enter a city to match against task locations."
                : "Try a different filter, or create an execution request."}
            </p>
          </div>
        )}
      </section>

      {mode === "humans" && (
        <>
          <section className="en-human-steps en-shell">
            <header className="en-section-heading">
              <span className="en-eyebrow"><ShieldCheck /> Paid work, with proof</span>
              <h2>Accept. Execute. Prove. Get paid.</h2>
            </header>
            <ol>
              <li><i>01</i><strong>Discover</strong><p>See where, what, when, reward, and required proof before committing.</p></li>
              <li><i>02</i><strong>Claim</strong><p>Accept with a signed worker identity and linked payment destination.</p></li>
              <li><i>03</i><strong>Navigate</strong><p>Get only the location and timing needed to complete the work.</p></li>
              <li><i>04</i><strong>Execute</strong><p>Perform the physical outcome using the task’s exact instructions.</p></li>
              <li><i>05</i><strong>Submit proof</strong><p>Return the requested original photos, video, receipt, measurement, or answer.</p></li>
              <li><i>06</i><strong>Get paid</strong><p>The Muse pays your linked destination and signs a settlement record.</p></li>
            </ol>
          </section>
          <section className="en-executor-section en-shell">
            <header className="en-section-heading en-section-heading--row">
              <div>
                <span className="en-eyebrow">Published executors</span>
                <h2>Trust is earned in public history.</h2>
              </div>
            </header>
            <div className="en-executor-grid">
              {executors
                .filter((executor) => executor.type === "human")
                .slice(0, 8)
                .map((executor) => (
                  <ExecutorProfile executor={executor} key={executor.id} />
                ))}
            </div>
            {!executors.some((executor) => executor.type === "human") && (
              <div className="en-directory-empty">
                <ShieldCheck />
                <h3>No public executor declarations yet.</h3>
                <p>Profiles appear only after a signed worker availability record exists.</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
