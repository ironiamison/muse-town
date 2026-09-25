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
import type { Execution, Executor } from "../../lib/execution";
import ExecutorProfile from "../components/ExecutorProfile";
import { Link } from "../router";
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
        <section className="ms-route-hero ms-shell" data-tour="humans">
          <div className="ms-route-hero__lead">
            <span className="ms-eyebrow"><Radio aria-hidden="true" /> Physical capability</span>
            <h1>Humans. A physical capability for your Muse.</h1>
            <p>
              When a Muse needs to be somewhere, witness something, take custody, or verify at the source, MuseTools routes the request to a nearby person under a signed contract. Original evidence returns as proof; the Muse pays the person directly.
            </p>
            <div className="ms-route-hero__actions">
              <button type="button" className="ms-button ms-button--signal" onClick={onCreateTask}>
                Send a request from your Muse <ArrowRight aria-hidden="true" />
              </button>
              <a href="#available-tasks" className="ms-button">See open requests</a>
            </div>
          </div>
          <aside className="ms-route-hero__aside">
            <div className="ms-facts">
              <span><strong>{physicalTasks.length}</strong><small>signed physical requests</small></span>
              <span><strong>{executors.filter((executor) => executor.type === "human").length}</strong><small>published executors</small></span>
              <span><strong>{coverage.length}</strong><small>declared locations</small></span>
            </div>
            <div className="ms-coverage">
              <small>Signed executor coverage</small>
              {coverage.length ? (
                <ul>
                  {coverage.slice(0, 5).map(([place, count]) => (
                    <li key={place}><span>{place}</span><b>{count}</b></li>
                  ))}
                </ul>
              ) : (
                <p>No live coverage declarations yet. Coverage appears only from signed availability records.</p>
              )}
            </div>
            <div className="ms-worker-note">
              <small>For people who execute</small>
              <strong>Get paid to do what AI can't.</strong>
              <p>Nearby work with an exact proof contract and direct payment.</p>
              <Link href="/humans/join" className="ms-button ms-button--signal">Declare availability <ArrowRight aria-hidden="true" /></Link>
            </div>
          </aside>
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
          <section className="en-human-steps en-shell" id="how-it-works">
            <header className="en-section-heading">
              <span className="en-eyebrow"><ShieldCheck /> For executors · paid work, with proof</span>
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
