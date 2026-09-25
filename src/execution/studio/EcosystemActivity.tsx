import { ArrowRight } from "lucide-react";
import type { Execution } from "../../lib/execution";
import { formatExecutionReward, locationLabel } from "../../lib/execution";
import { CONTINUATIONS, POWERS, powerForCapability, type PowerId } from "../../lib/powers";
import type { MuseSkill } from "../../lib/skills";
import { Link } from "../router";

function relative(timestamp: number) {
  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function EcosystemActivity({
  executions,
  skills,
  networkState,
  publishedHumans,
  onPick,
}: {
  executions: Execution[];
  skills: MuseSkill[];
  networkState: "loading" | "live" | "offline" | string;
  publishedHumans: number;
  onPick: (continuationId: string) => void;
}) {
  const recent = [...executions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const liveSkills = skills.filter((skill) => skill.availability === "live" && skill.endpoint).length;
  const counts = executions.reduce<Record<PowerId, number>>(
    (acc, execution) => {
      const power = powerForCapability(execution.capability.id);
      acc[power] += 1;
      return acc;
    },
    { GO: 0, SEE: 0, GET: 0, VERIFY: 0, USE: 0, PAY: 0 },
  );

  return (
    <>
      <section className="ms-ecosystem ms-shell" aria-labelledby="ms-ecosystem-title" data-tour="network">
        <header className="ms-section-head">
          <span className="ms-eyebrow">Across the network</span>
          <h2 id="ms-ecosystem-title">What Muses are giving themselves</h2>
          <p>
            Signed public records only. {networkState === "live" ? `${executions.length} executions, ${publishedHumans} published humans, ${liveSkills} live skills.` : networkState === "loading" ? "Reading the ledger…" : networkState === "unconfigured" ? "This deployment has no ledger yet, so nothing is shown." : "The ledger is unreachable, so nothing is shown."}
          </p>
        </header>

        <div className="ms-ecosystem__grid">
          <ol className="ms-feed" aria-label="Recent executions">
            {recent.map((execution) => {
              const power = powerForCapability(execution.capability.id);
              return (
                <li key={`${execution.source}-${execution.id}`}>
                  <Link href={`/executions/${execution.id}`}>
                    <b data-power={power}>{power}</b>
                    <span className="ms-feed__title">{execution.title}</span>
                    <span className="ms-feed__meta">
                      {execution.requester.name} · {locationLabel(execution.location) || "location withheld"} · {formatExecutionReward(execution)} · {relative(execution.createdAt)}
                    </span>
                    <span className="ms-feed__status" data-status={execution.status}>{execution.status.toLowerCase().replace("_", " ")}</span>
                  </Link>
                </li>
              );
            })}
            {!recent.length && networkState !== "loading" && (
              <li className="ms-feed__empty">
                No signed execution has been published yet. The first one will appear here as a public record, not a demo.
              </li>
            )}
          </ol>

          <dl className="ms-tally" aria-label="Executions by power">
            {POWERS.map((power) => (
              <div key={power.id}>
                <dt>{power.id}</dt>
                <dd>{counts[power.id]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="ms-catalog ms-shell" aria-labelledby="ms-catalog-title" data-tour="catalog">
        <header className="ms-section-head">
          <span className="ms-eyebrow">Explore</span>
          <h2 id="ms-catalog-title">Everything your Muse can be given</h2>
        </header>
        <div className="ms-catalog__groups">
          {POWERS.map((power) => (
            <div key={power.id} className="ms-catalog__group">
              <h3>
                <b>{power.id}</b> <span>{power.gloss}</span>
              </h3>
              <ul>
                {CONTINUATIONS.filter((item) => item.power === power.id).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onPick(item.id)} data-availability={item.availability}>
                      <span>{item.phrase}</span>
                      {item.availability !== "live" && <em>{item.availability.replace("_", " ")}</em>}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <footer className="ms-catalog__foot">
          <Link href="/capabilities">Full capability catalog</Link>
          <Link href="/humans">Humans as a capability</Link>
          <Link href="/developers">Connect a Muse by API</Link>
        </footer>
      </section>
    </>
  );
}
