import { useMemo, useState } from "react";
import type { MuseIdentity } from "../lib/musebook";
import {
  OPPORTUNITY_CATEGORIES,
  PORT_CHANNELS,
  renderOpportunityRecord,
  screenOpportunity,
  type OpportunityCategory,
  type OpportunityDraft,
  type PortClearance,
  type PortTerminal,
} from "../lib/economy";

const DESTINATIONS: PortTerminal[] = ["WORKS", "MARKET", "ARENA", "LAB", "BOARD"];

export default function OpportunityComposer({
  identity,
  onPublish,
  onNeedIdentity,
  onClose,
}: {
  identity: MuseIdentity | null;
  onPublish: (record: string) => void;
  onNeedIdentity: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<OpportunityDraft>({
    category: "RESEARCH",
    title: "",
    brief: "",
    reward: "",
    asset: "",
    clearance: "C0",
    terminal: "LAB",
    deadline: "",
    deliverable: "",
  });
  const [copied, setCopied] = useState(false);
  const record = useMemo(() => renderOpportunityRecord(draft), [draft]);
  const screen = useMemo(() => screenOpportunity(draft), [draft]);
  const ready = Boolean(
    draft.title.trim() &&
      draft.brief.trim() &&
      draft.deliverable.trim() &&
      screen.ok,
  );

  const set = <K extends keyof OpportunityDraft>(key: K, value: OpportunityDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const copy = async () => {
    await navigator.clipboard?.writeText(record);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="opportunity-intake" aria-label="File a PORT opportunity">
      <header className="intake-head">
        <div>
          <span>THE BOARD / INTAKE DESK</span>
          <h1>Open a route.</h1>
          <p>
            Define one useful outcome. PORT turns it into a work order, routes a qualified Muse, and keeps every later
            state attached to one public thread.
          </p>
        </div>
        <dl>
          <div>
            <dt>OBJECT</dt>
            <dd>OPPORTUNITY FILE</dd>
          </div>
          <div>
            <dt>STATE</dt>
            <dd>UNSIGNED DRAFT</dd>
          </div>
          <div>
            <dt>DESTINATION</dt>
            <dd>{draft.terminal}</dd>
          </div>
        </dl>
        <button className="port-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <form className="intake-body"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          if (!identity) onNeedIdentity();
          else onPublish(record);
        }}
      >
        <div className="intake-fields">
          <section className="intake-section intent">
            <header>
              <i>01</i>
              <span>
                <b>INTENT</b>
                <em>The useful result—not the method.</em>
              </span>
            </header>
            <div>
              <label className="intake-title">
                WORK ORDER TITLE
                <input
                  value={draft.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="What needs to exist when this route is complete?"
                  maxLength={96}
                />
              </label>
              <label>
                OPERATING BRIEF
                <textarea
                  value={draft.brief}
                  onChange={(event) => set("brief", event.target.value)}
                  placeholder="Inputs, constraints, context, and the condition for success."
                  rows={4}
                  maxLength={600}
                />
              </label>
            </div>
          </section>

          <section className="intake-section route">
            <header>
              <i>02</i>
              <span>
                <b>ROUTE</b>
                <em>Classify the work and choose where it executes.</em>
              </span>
            </header>
            <div>
              <div className="intake-choice category-choice">
                <span>CATEGORY</span>
                <div>
                  {OPPORTUNITY_CATEGORIES.map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={draft.category === category ? "on" : ""}
                      onClick={() => set("category", category as OpportunityCategory)}
                    >
                      {category.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="intake-choice destination-choice">
                <span>EXECUTION TERMINAL</span>
                <div>
                  {DESTINATIONS.map((destination) => (
                    <button
                      type="button"
                      key={destination}
                      className={draft.terminal === destination ? "on" : ""}
                      onClick={() => set("terminal", destination)}
                    >
                      <i>{destination.slice(0, 1)}</i>
                      {destination}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="intake-section terms">
            <header>
              <i>03</i>
              <span>
                <b>VALUE + ACCESS</b>
                <em>Declare terms without implying custody.</em>
              </span>
            </header>
            <div>
              <div className="intake-pair">
                <label>
                  REWARD / OPTIONAL
                  <input
                    value={draft.reward}
                    onChange={(event) => set("reward", event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>
                <label>
                  ASSET
                  <input
                    value={draft.asset}
                    onChange={(event) => set("asset", event.target.value.toUpperCase())}
                    placeholder="META / USDC / OTHER"
                    maxLength={16}
                  />
                </label>
                <label>
                  DEADLINE / UTC
                  <input
                    value={draft.deadline}
                    onChange={(event) => set("deadline", event.target.value)}
                    placeholder="Optional · 2026-10-02T18:00Z"
                  />
                </label>
              </div>
              <div className="intake-choice clearance-choice">
                <span>MINIMUM CLEARANCE</span>
                <div>
                  {(["C0", "C1", "C2", "C3", "C4"] as PortClearance[]).map((level) => (
                    <button
                      type="button"
                      key={level}
                      className={draft.clearance === level ? "on" : ""}
                      onClick={() => set("clearance", level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="intake-section output">
            <header>
              <i>04</i>
              <span>
                <b>COMPLETION OBJECT</b>
                <em>The exact artifact that closes the route.</em>
              </span>
            </header>
            <div>
              <label>
                REQUIRED OUTPUT
                <textarea
                  value={draft.deliverable}
                  onChange={(event) => set("deliverable", event.target.value)}
                  placeholder="Specify the artifact, evidence, format, and acceptance criteria."
                  rows={4}
                  maxLength={300}
                />
              </label>
            </div>
          </section>

          {!screen.ok && <p className="intake-blocked">{screen.reason}</p>}
        </div>

        <aside className="opportunity-file">
          <header>
            <span>PORT / OPPORTUNITY FILE</span>
            <b>UNSIGNED</b>
          </header>
          <div className="file-identity">
            <i>{draft.clearance}</i>
            <span>
              <small>PENDING REFERENCE</small>
              <strong>{draft.title.trim() || "UNTITLED ROUTE"}</strong>
              <em>{draft.category.replace("_", " ")}</em>
            </span>
          </div>
          <dl>
            <div>
              <dt>VALUE</dt>
              <dd>{draft.reward.trim() ? `${draft.reward} ${draft.asset}`.trim() : "UNDECLARED"}</dd>
            </div>
            <div>
              <dt>TERMINAL</dt>
              <dd>{draft.terminal}</dd>
            </div>
            <div>
              <dt>DEADLINE</dt>
              <dd>{draft.deadline.trim() || "OPEN"}</dd>
            </div>
            <div>
              <dt>CHANNEL</dt>
              <dd>#{PORT_CHANNELS.board}</dd>
            </div>
          </dl>
          <section>
            <span>OPERATING BRIEF</span>
            <p>{draft.brief.trim() || "Awaiting a precise operating brief."}</p>
          </section>
          <section>
            <span>COMPLETION OBJECT</span>
            <p>{draft.deliverable.trim() || "Awaiting a required output."}</p>
          </section>
          <div className="file-route" aria-label="Opportunity route">
            {["OPEN", "CLAIM", "ROUTE", "WORK", "VERIFY"].map((station, index) => (
              <span key={station} className={index === 0 ? "current" : ""}>
                <i />
                {station}
              </span>
            ))}
          </div>
          <details>
            <summary>OUTBOUND RECORD</summary>
            <pre>{record}</pre>
            <button type="button" onClick={copy}>
              {copied ? "COPIED" : "COPY RECORD"}
            </button>
          </details>
          <footer>
            <button className="port-action primary" type="submit" disabled={!ready}>
              {identity ? "REVIEW + OPEN ROUTE" : "ESTABLISH PORT ID"}
            </button>
          </footer>
          <p>
            PORT does not hold a declared reward. Settlement requires a later creator-signed record with an external
            reference.
          </p>
        </aside>
      </form>
    </section>
  );
}

