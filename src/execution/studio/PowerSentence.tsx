import { ArrowRight, CornerDownLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MuseState } from "../../lib/muse-state";
import type { TaskDraft } from "../../lib/port";
import { POWERS, continuationsFor, type PowerId } from "../../lib/powers";
import { draftFor } from "./CapabilityLoop";
import type { CapabilityLoop } from "./useCapabilityLoop";

function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => void };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduced) doc.startViewTransition(update);
  else update();
}

export default function PowerSentence({
  loop,
  museState,
  onPublish,
}: {
  loop: CapabilityLoop;
  museState: MuseState;
  onPublish: (draft: Partial<TaskDraft>) => void;
}) {
  const { state, continuation } = loop;
  const intentRef = useRef<HTMLTextAreaElement>(null);
  const returned = state.stage === "returned";
  const subject = museState.muse ? museState.muse.name.toUpperCase() : "YOUR MUSE";
  const showContinuations = state.power && ["power", "continuation", "intent"].includes(state.stage);
  const showIntent = continuation && ["continuation", "intent"].includes(state.stage);

  useEffect(() => {
    if (showIntent) intentRef.current?.focus({ preventScroll: true });
  }, [showIntent, continuation?.id]);

  const choosePower = (power: PowerId) => withTransition(() => loop.selectPower(power));
  const chooseContinuation = (id: string) => withTransition(() => loop.selectContinuation(id));

  return (
    <div className={`ms-sentence-block is-${state.stage}`}>
      <p className="ms-sentence" aria-live="polite">
        <span className="ms-sentence__subject">{subject}</span>
        <span className="ms-sentence__verb">{returned ? "NOW KNOWS" : "CAN"}</span>
        {state.power && !returned && (
          <b className="ms-sentence__power" style={{ viewTransitionName: `power-${state.power}` }}>
            {state.power}
          </b>
        )}
        {!state.power && !returned && <b className="ms-sentence__slot" aria-label="a power">____</b>}
        {continuation && !returned && (
          <i className="ms-sentence__continuation">{continuation.phrase}</i>
        )}
        {returned && <i className="ms-sentence__continuation">what it could not see alone.</i>}
      </p>

      {!returned && (
        <div className="ms-verbs" role="radiogroup" aria-label="Powers" data-tour="powers">
          {POWERS.map((power) => {
            const availability = museState.powers[power.id].availability;
            const selected = state.power === power.id;
            return (
              <button
                key={power.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-availability={availability}
                className={`ms-verb ${selected ? "is-selected" : ""} ${state.power && !selected ? "is-dimmed" : ""}`}
                style={!selected ? { viewTransitionName: `power-${power.id}` } : undefined}
                onClick={() => choosePower(power.id)}
              >
                <b>{power.id}</b>
                <span>{power.gloss}</span>
              </button>
            );
          })}
        </div>
      )}

      {showContinuations && state.power && (
        <div className="ms-continuations" role="radiogroup" aria-label={`${state.power} continuations`}>
          <p className="ms-continuations__meaning">{POWERS.find((power) => power.id === state.power)?.meaning}</p>
          <div className="ms-continuations__list">
            {continuationsFor(state.power).map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={continuation?.id === item.id}
                data-availability={item.availability}
                className={`ms-continuation ${continuation?.id === item.id ? "is-selected" : ""}`}
                onClick={() => chooseContinuation(item.id)}
              >
                <ArrowRight aria-hidden="true" />
                <span>{item.phrase}</span>
                {item.flagship && <em>example</em>}
                {item.availability !== "live" && <em>{item.availability.replace("_", " ")}</em>}
              </button>
            ))}
          </div>
        </div>
      )}

      {showIntent && continuation && (
        <form
          className="ms-intent"
          onSubmit={(event) => {
            event.preventDefault();
            if (!state.intent.trim()) return;
            if (continuation.flagship) loop.send();
            else if (continuation.availability === "live") onPublish(draftFor(continuation, state.intent));
          }}
        >
          <label>
            <span>{subject === "YOUR MUSE" ? "Your Muse says" : `${museState.muse?.name} says`}</span>
            <textarea
              ref={intentRef}
              rows={2}
              value={state.intent}
              maxLength={240}
              onChange={(event) => loop.setIntent(event.target.value)}
              placeholder="Describe the outcome in one sentence."
            />
          </label>
          <div className="ms-intent__actions">
            {continuation.flagship || continuation.availability === "live" ? (
              <button type="submit" className="ms-button ms-button--signal" disabled={!state.intent.trim()}>
                {continuation.flagship ? "Send from Muse" : museState.canSign ? "Do this for real" : "Do this for real · connect signer"}
                <CornerDownLeft aria-hidden="true" />
              </button>
            ) : (
              <span className="ms-intent__unavailable">{continuation.availability === "preview" ? "Preview" : "Not configured"}</span>
            )}
            <small>
              {continuation.flagship
                ? "Plays the labeled example. Nothing is published until you choose “Do this for real”."
                : continuation.availabilityNote}
            </small>
          </div>
        </form>
      )}
    </div>
  );
}
