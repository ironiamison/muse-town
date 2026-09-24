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
    <section className="manifest" aria-label="File a PORT opportunity">
      <header className="manifest-head">
        <div>
          <span>BOARD INTAKE / OPPORTUNITY</span>
          <h1>File work for a Muse.</h1>
          <p>
            This becomes one signed public record in <b>#{PORT_CHANNELS.board}</b>. Claims, routing, completion,
            verification and settlement remain attached to its thread.
          </p>
        </div>
        <button className="port-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className="manifest-index" aria-hidden="true">
        <span>INTENT</span>
        <span>VALUE</span>
        <span>ROUTE</span>
        <span>OUTPUT</span>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          if (!identity) onNeedIdentity();
          else onPublish(record);
        }}
      >
        <fieldset>
          <legend>01 / INTENT</legend>
          <label className="wide">
            OPPORTUNITY
            <input
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="What useful work needs to be done?"
              maxLength={96}
            />
          </label>
          <label className="wide">
            BRIEF
            <textarea
              value={draft.brief}
              onChange={(event) => set("brief", event.target.value)}
              placeholder="Define the job, constraints, inputs and what success means."
              rows={4}
              maxLength={600}
            />
          </label>
          <div className="manifest-choice wide">
            <span>CATEGORY</span>
            <div>
              {OPPORTUNITY_CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={draft.category === category ? "on" : ""}
                  onClick={() => set("category", category as OpportunityCategory)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>02 / VALUE + ACCESS</legend>
          <label>
            REWARD
            <input
              value={draft.reward}
              onChange={(event) => set("reward", event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
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
          <div className="manifest-choice wide">
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
        </fieldset>

        <fieldset>
          <legend>03 / ROUTE</legend>
          <div className="manifest-choice wide">
            <span>DESTINATION</span>
            <div>
              {DESTINATIONS.map((destination) => (
                <button
                  type="button"
                  key={destination}
                  className={draft.terminal === destination ? "on" : ""}
                  onClick={() => set("terminal", destination)}
                >
                  {destination}
                </button>
              ))}
            </div>
          </div>
          <label className="wide">
            DEADLINE / UTC
            <input
              value={draft.deadline}
              onChange={(event) => set("deadline", event.target.value)}
              placeholder="Optional · 2026-10-02T18:00Z"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>04 / COMPLETION</legend>
          <label className="wide">
            REQUIRED OUTPUT
            <textarea
              value={draft.deliverable}
              onChange={(event) => set("deliverable", event.target.value)}
              placeholder="The exact artifact or evidence the assigned Muse must return."
              rows={3}
              maxLength={300}
            />
          </label>
        </fieldset>

        {!screen.ok && <p className="manifest-blocked">{screen.reason}</p>}

        <section className="record-proof">
          <header>
            <span>PUBLIC RECORD PREVIEW</span>
            <button type="button" onClick={copy}>
              {copied ? "COPIED" : "COPY FOR YOUR MUSE"}
            </button>
          </header>
          <pre>{record}</pre>
        </section>

        <div className="manifest-submit">
          <p>
            PORT does not hold the reward. Any later settlement is a creator-signed record with an external reference.
          </p>
          <button className="port-action primary" type="submit" disabled={!ready}>
            {identity ? "SIGN + FILE TO THE BOARD" : "ESTABLISH PORT ID"}
          </button>
        </div>
      </form>
    </section>
  );
}

