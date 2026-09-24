import { ArrowLeft, ArrowRight, Clock3, Code2, DollarSign, ShieldCheck } from "lucide-react";
import type { Capability } from "../../lib/capabilities";
import type { Execution } from "../../lib/execution";
import ExecutionRow from "../components/ExecutionRow";
import { Link } from "../router";

function schema(schema: Capability["inputSchema"]) {
  return JSON.stringify(schema, null, 2);
}

export default function CapabilityPage({
  capability,
  executions,
  onCreateTask,
}: {
  capability: Capability;
  executions: Execution[];
  onCreateTask: () => void;
}) {
  const recent = executions.filter((execution) => execution.capability.id === capability.id);
  return (
    <main className="en-page">
      <section className="en-capability-detail-head">
        <div className="en-shell">
          <Link href="/explore" className="en-back-link"><ArrowLeft /> All capabilities</Link>
          <div className="en-capability-detail-head__grid">
            <div>
              <span className="en-eyebrow">{capability.category} capability</span>
              <h1>{capability.name}</h1>
              <p>{capability.description}</p>
              <code>{capability.id}</code>
              <div className="en-hero__actions">
                {capability.category === "physical" || capability.id === "rent_human" ? (
                  <button className="en-button en-button--primary" onClick={onCreateTask}>
                    Request execution <ArrowRight />
                  </button>
                ) : (
                  <Link href="/build" className="en-button en-button--dark">
                    Build with this capability <ArrowRight />
                  </Link>
                )}
              </div>
            </div>
            <dl className="en-capability-facts">
              <div><dt><Clock3 /> Typical time</dt><dd>{capability.estimatedDuration}</dd></div>
              <div><dt><DollarSign /> Price model</dt><dd>{capability.estimatedPrice.model.replaceAll("_", " ")}</dd></div>
              <div><dt><ShieldCheck /> Availability</dt><dd><i className={`en-availability en-availability--${capability.availability}`}>{capability.availability}</i></dd></div>
              <div><dt><Code2 /> Executors</dt><dd>{capability.executorTypes.join(" · ")}</dd></div>
            </dl>
          </div>
        </div>
      </section>
      <section className="en-capability-detail en-shell">
        <div className="en-capability-detail__main">
          <section>
            <span className="en-doc-number">Example request</span>
            <h2>{capability.example}</h2>
            <p>
              Required proof: {capability.proofTypes.map((type) => type.toLowerCase()).join(", ") || "provider-defined"}.
            </p>
          </section>
          <section>
            <h2>Input schema</h2>
            <pre><code>{schema(capability.inputSchema)}</code></pre>
          </section>
          <section>
            <h2>Output schema</h2>
            <pre><code>{schema(capability.outputSchema)}</code></pre>
          </section>
        </div>
        <aside>
          <h2>Invocation</h2>
          <p>Publish a complete signed envelope to the task endpoint.</p>
          <pre><code>{`POST /api/tasks\nGET /api/tasks/:id\nGET /api/results/:id`}</code></pre>
          <a href={`/api/capabilities/${capability.id}`}>Open machine schema <ArrowRight /></a>
        </aside>
      </section>
      <section className="en-shell en-recent-capability">
        <header className="en-section-heading">
          <span className="en-eyebrow">Recent executions</span>
          <h2>Signed network activity.</h2>
        </header>
        <div className="en-execution-list">
          {recent.map((execution) => <ExecutionRow execution={execution} key={`${execution.source}-${execution.id}`} />)}
        </div>
        {!recent.length && (
          <div className="en-directory-empty">
            <Code2 />
            <h3>No signed execution uses this capability yet.</h3>
            <p>Availability describes protocol support, not fabricated demand.</p>
          </div>
        )}
      </section>
    </main>
  );
}
