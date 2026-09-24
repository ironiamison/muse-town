import {
  ArrowRight,
  Check,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { MuseSkill } from "../../lib/skills";
import MuseCore from "../components/MuseCore";

export default function SkillsPage({
  identity,
  skills,
  onConnect,
}: {
  identity: MuseIdentity | null;
  skills: MuseSkill[];
  onConnect: () => void;
}) {
  const [selectedId, setSelectedId] = useState(skills[0]?.id ?? "");
  const [activated, setActivated] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const selected = skills.find((skill) => skill.id === selectedId) ?? skills[0] ?? null;
  const search = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      skills.filter((skill) =>
        !search
          ? true
          : [skill.name, skill.description, skill.category, ...skill.actions.map((item) => item.id)]
              .join(" ")
              .toLowerCase()
              .includes(search),
      ),
    [search, skills],
  );
  const activeSkills = skills.filter((skill) => activated.includes(skill.id));
  const activeActions = activeSkills.reduce((sum, skill) => sum + skill.actions.length, 0);
  const selectedActive = selected ? activated.includes(selected.id) : false;
  const actionCountBefore =
    activeActions - (selected && selectedActive ? selected.actions.length : 0);
  const actionCountAfter =
    actionCountBefore + (selected?.actions.length ?? 0);

  const toggle = (skill: MuseSkill) => {
    setActivated((current) =>
      current.includes(skill.id)
        ? current.filter((id) => id !== skill.id)
        : [...current, skill.id],
    );
  };

  return (
    <main className="en-page skills-page">
      <section className="skills-hero">
        <div className="en-shell skills-hero__layout">
          <div className="skills-hero__copy">
            <span className="en-eyebrow"><Sparkles /> Callable capability system</span>
            <h1>Give it abilities.</h1>
            <p>Skills expose actions a Muse can discover, price, invoke, and use.</p>
            <button className="en-button en-button--primary" onClick={onConnect}>
              {identity ? `Muse: ${identity.name}` : "Connect your Muse"} <ArrowRight />
            </button>
          </div>
          <MuseCore
            identity={identity}
            active="skills"
            actionLabel={
              activeSkills.length ? `${activeActions} actions in preview` : "Select an ability"
            }
            resultLabel={
              activeSkills.length ? `${activeSkills.length} skills activated` : "Capability set unchanged"
            }
            onConnect={onConnect}
            compact
          />
          <div className="skills-capability-count">
            <span>Session capability preview</span>
            <strong>{activeActions}</strong>
            <small>actions activated</small>
            <i />
            <em>Preview only · no install has been published</em>
          </div>
        </div>
      </section>

      <section className="skill-lab en-shell">
        <header className="en-section-heading">
          <span className="en-eyebrow">Ability activation</span>
          <h2>Select a skill. Watch the Muse gain actions.</h2>
          <p>This interaction previews the capability change. Only signed live providers can be invoked.</p>
        </header>
        <div className="skill-lab__workspace">
          <div className="skill-lab__rail">
            {skills.slice(0, 9).map((skill) => (
              <button
                key={skill.id}
                className={`${selected?.id === skill.id ? "selected" : ""} ${activated.includes(skill.id) ? "activated" : ""}`}
                onClick={() => setSelectedId(skill.id)}
              >
                <Sparkles />
                <span><strong>{skill.name}</strong><small>{skill.actions.length} actions · {skill.availability}</small></span>
                {activated.includes(skill.id) && <Check />}
              </button>
            ))}
          </div>
          {selected && (
            <article className={`skill-focus ${activated.includes(selected.id) ? "is-activated" : ""}`}>
              <header>
                <div><small>{selected.source === "signed_service" ? "Signed provider skill" : "Catalog definition"}</small><h3>{selected.name}</h3><p>{selected.description}</p></div>
                <span className={`en-availability en-availability--${selected.availability === "preview" ? "experimental" : selected.availability}`}>{selected.availability}</span>
              </header>
              <div className="skill-focus__before">
                <span>Capability set</span>
                <strong>{actionCountBefore}</strong>
                <ArrowRight />
                <strong>{actionCountAfter}</strong>
              </div>
              <div className="skill-focus__actions">
                {selected.actions.map((item) => (
                  <span key={item.id}><Plus /><code>{item.id}</code><small>{item.description}</small></span>
                ))}
              </div>
              <footer>
                <div>
                  <span>Pricing</span>
                  <strong>{selected.pricing.amount === null ? selected.pricing.model.replaceAll("_", " ") : `${selected.pricing.amount} ${selected.pricing.currency} / call`}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{selected.provider?.name ?? "No live provider declared"}</strong>
                </div>
                <button
                  className={`en-button ${activated.includes(selected.id) ? "en-button--secondary" : "en-button--primary"}`}
                  onClick={() => toggle(selected)}
                >
                  {activated.includes(selected.id) ? <><X /> Remove preview</> : <><Plus /> Preview activation</>}
                </button>
              </footer>
            </article>
          )}
        </div>
      </section>

      <section className="skills-browser">
        <div className="en-shell">
          <header className="en-section-heading en-section-heading--row">
            <div><span className="en-eyebrow">Machine-readable directory</span><h2>Discover every action.</h2></div>
            <label className="en-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills and actions" /></label>
          </header>
          <div className="skills-list">
            {visible.map((skill) => (
              <button key={skill.id} onClick={() => { setSelectedId(skill.id); window.scrollTo({ top: 560, behavior: "smooth" }); }}>
                <span><Sparkles /><strong>{skill.name}</strong></span>
                <span>{skill.actions.map((item) => item.id).slice(0, 4).join(" · ")}</span>
                <em>{skill.provider?.name ?? "Definition only"}</em>
                <i className={`en-availability en-availability--${skill.availability === "preview" ? "experimental" : skill.availability}`}>{skill.availability}</i>
              </button>
            ))}
          </div>
          {!visible.length && <div className="en-directory-empty"><Search /><h3>No skill matches.</h3><p>Try searching by action, such as purchase, translate, or monitor.</p></div>}
        </div>
      </section>
    </main>
  );
}
