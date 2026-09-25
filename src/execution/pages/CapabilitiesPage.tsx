import { ArrowRight, Command, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CAPABILITIES, type Capability } from "../../lib/capabilities";
import { POWERS, continuationsFor, powerAvailability } from "../../lib/powers";
import type { MuseSkill } from "../../lib/skills";
import { Link } from "../router";

type Primitive = {
  id: string;
  name: string;
  description: string;
  group: "physical" | "specialist" | "machine";
  pricing: string;
  availability: string;
  time: string;
  proof: string[];
  inputs: string[];
  outputs: string[];
  invocation: string;
  schemaHref: string;
};

function capabilityPrimitive(capability: Capability): Primitive {
  return {
    id: capability.id,
    name: capability.name,
    description: capability.description,
    group: capability.category === "physical" || capability.id === "rent_human" ? "physical" : "machine",
    pricing:
      capability.estimatedPrice.minimum === null
        ? capability.estimatedPrice.model.replaceAll("_", " ")
        : `from ${capability.estimatedPrice.minimum} ${capability.estimatedPrice.currency}`,
    availability: capability.availability,
    time: capability.estimatedDuration,
    proof: capability.proofTypes.map((item) => item.toLowerCase()),
    inputs: Object.keys(capability.inputSchema.properties ?? {}),
    outputs: Object.keys(capability.outputSchema.properties ?? {}),
    invocation: `POST /api/tasks\ncapability: ${capability.id}`,
    schemaHref: `/api/capabilities/${capability.id}`,
  };
}

function skillPrimitive(skill: MuseSkill): Primitive {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    group: skill.source === "signed_service" ? "specialist" : "machine",
    pricing:
      skill.pricing.amount === null
        ? skill.pricing.model.replaceAll("_", " ")
        : `${skill.pricing.amount} ${skill.pricing.currency} / call`,
    availability: skill.availability,
    time: "provider defined",
    proof: ["structured result"],
    inputs: skill.actions.flatMap((action) => Object.keys(action.inputSchema.properties ?? {})),
    outputs: skill.actions.flatMap((action) => Object.keys(action.outputSchema.properties ?? {})),
    invocation:
      skill.endpoint && skill.availability === "live"
        ? skill.endpoint
        : `GET /api/skills/${skill.id}`,
    schemaHref: `/api/skills/${skill.id}`,
  };
}

export default function CapabilitiesPage({ skills }: { skills: MuseSkill[] }) {
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("rent_human");
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const primitives = useMemo(() => {
    const capabilityItems = CAPABILITIES.filter(
      (capability) =>
        capability.category === "physical" ||
        capability.id === "rent_human" ||
        capability.availability === "live",
    ).map(capabilityPrimitive);
    const skillItems = skills.map(skillPrimitive);
    const unique = new Map<string, Primitive>();
    [...capabilityItems, ...skillItems].forEach((item) => unique.set(item.id, item));
    return [...unique.values()];
  }, [skills]);
  const visible = primitives.filter((item) =>
    !query
      ? true
      : [item.id, item.name, item.description, item.group]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
  );
  const selected = primitives.find((item) => item.id === selectedId) ?? primitives[0];

  const availability = powerAvailability(skills, false);

  return (
    <main className="en-page capabilities-page">
      <section className="ms-route-hero ms-shell">
        <div className="ms-route-hero__lead">
          <span className="ms-eyebrow">Powers</span>
          <h1>Six powers. One signed interface.</h1>
          <p>
            Every power maps to callable capabilities with an explicit proof contract. Availability is derived from signed network records, never asserted.
          </p>
          <div className="ms-route-hero__actions">
            <Link href="/" className="ms-button ms-button--signal">Give your Muse a power <ArrowRight aria-hidden="true" /></Link>
            <a href="/openapi.json" className="ms-button">OpenAPI</a>
          </div>
        </div>
        <img className="ms-route-muse ms-route-muse--powers" src="/muse-corner-climber.png" alt="" aria-hidden="true" />
        <div className="ms-route-hero__aside">
          <ol className="ms-power-list" aria-label="Powers" data-tour="power-list">
            {POWERS.map((power) => (
              <li key={power.id} data-availability={availability[power.id].availability}>
                <b>{power.id}</b>
                <span>{power.gloss}</span>
                <small>{availability[power.id].availability.replace("_", " ")} · {continuationsFor(power.id).length} continuations</small>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="cap-command en-shell">
        <header>
          <div><small>Callable capabilities</small><h1>Catalog</h1></div>
          <span><Command /> K</span>
        </header>
        <label className="cap-command__search">
          <Search />
          <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What does your Muse need to do?" />
          {query && <button onClick={() => setQuery("")}><X /></button>}
        </label>
      </section>
      <section className="cap-browser en-shell">
        <div className="cap-list">
          {(["physical", "specialist", "machine"] as const).map((group) => {
            const groupItems = visible.filter((item) => item.group === group);
            if (!groupItems.length) return null;
            return (
              <section key={group}>
                <header><span>{group}</span><small>{groupItems.length} available definitions</small></header>
                {groupItems.map((item) => (
                  <button className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)} key={item.id}>
                    <code>{item.id}</code>
                    <span>{item.pricing}</span>
                    <em>{item.availability}</em>
                    <ArrowRight />
                  </button>
                ))}
              </section>
            );
          })}
          {!visible.length && <div className="cap-list__empty">No capability matches “{query}”.</div>}
        </div>
        {selected && (
          <aside className="cap-inspector">
            <header>
              <small>{selected.group} / {selected.availability}</small>
              <h2>{selected.id}</h2>
              <p>{selected.description}</p>
            </header>
            <dl>
              <div><dt>Pricing</dt><dd>{selected.pricing}</dd></div>
              <div><dt>Execution time</dt><dd>{selected.time}</dd></div>
              <div><dt>Availability</dt><dd>{selected.availability}</dd></div>
            </dl>
            <section><span>Inputs</span><div>{selected.inputs.map((input) => <code key={input}>{input}</code>)}</div></section>
            <section><span>Outputs</span><div>{selected.outputs.map((output) => <code key={output}>{output}</code>)}</div></section>
            <section><span>Proof contract</span><div>{selected.proof.map((proof) => <code key={proof}>{proof}</code>)}</div></section>
            <pre><code>{selected.invocation}</code></pre>
            <footer><ShieldCheck /><span>Inspect machine schema before invocation.</span><a href={selected.schemaHref}>Open JSON <ArrowRight /></a></footer>
          </aside>
        )}
      </section>
    </main>
  );
}
