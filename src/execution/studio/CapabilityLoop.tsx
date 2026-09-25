import { ArrowUpRight, Check, RotateCcw, ShieldCheck } from "lucide-react";
import { DEMO_LABEL, FLAGSHIP } from "../../demo/flagship";
import type { MuseState } from "../../lib/muse-state";
import { capabilityFor, type Continuation } from "../../lib/powers";
import type { TaskDraft } from "../../lib/port";
import MotionVideo from "../components/MotionVideo";
import { Link } from "../router";
import type { CapabilityLoop as Loop } from "./useCapabilityLoop";

export function draftFor(continuation: Continuation, intent: string): Partial<TaskDraft> {
  return {
    category: continuation.category ?? "OTHER",
    executor: continuation.power === "USE" && continuation.id !== "use_signed_skill" ? "agent" : "human",
    title: continuation.draft?.title ?? intent.slice(0, 80),
    objective: intent.trim() || continuation.draft?.objective || "",
    duration: continuation.draft?.duration ?? "",
    proof: continuation.proof.map((item) => ({ ...item })),
  };
}

function Contract({ continuation }: { continuation: Continuation }) {
  const capability = capabilityFor(continuation);
  return (
    <div className="ms-contract">
      <dl>
        <div>
          <dt>Capability</dt>
          <dd>
            <Link href={`/capabilities/${capability.id}`}>{capability.name}</Link>
          </dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{continuation.power === "USE" || continuation.id === "pay_machine" ? "provider" : "human"}</dd>
        </div>
        <div>
          <dt>Proof contract</dt>
          <dd>
            <ul>
              {continuation.proof.map((item) => (
                <li key={`${item.type}-${item.description}`}>
                  <b>{item.type}</b> {item.description}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd data-availability={continuation.availability}>
            <b>{continuation.availability.replace("_", " ")}</b> {continuation.availabilityNote}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function CapabilityLoop({
  loop,
  museState,
  onPublish,
}: {
  loop: Loop;
  museState: MuseState;
  onPublish: (draft: Partial<TaskDraft>) => void;
}) {
  const { state, continuation, flagship } = loop;
  if (!continuation) return null;
  const stage = state.stage;
  const sent = ["matching", "accepted", "executing", "proof", "returned"].includes(stage);
  const reality = stage === "executing" || stage === "proof";
  const returned = stage === "returned";
  const stageIndex = ["matching", "accepted", "executing", "proof", "returned"].indexOf(stage);
  const publishLabel = museState.canSign ? "Do this for real" : "Do this for real · connect signer";

  if (!sent || !flagship) {
    if (stage === "intent" || stage === "continuation") {
      return (
        <section className="ms-loop is-contract" aria-label="What leaves the Muse">
          <header className="ms-loop__head">
            <span className="ms-eyebrow">What leaves the Muse</span>
            <span className="ms-eyebrow ms-eyebrow--muted">
              {continuation.power === "USE" || continuation.id === "pay_machine" ? "provider contract" : "port/1 · signed by the requester"}
            </span>
          </header>
          <Contract continuation={continuation} />
        </section>
      );
    }
    return null;
  }

  return (
    <section className={`ms-loop is-${stage} ${reality ? "has-reality" : ""}`} aria-label="Example execution" aria-live="polite">
      <header className="ms-loop__head">
        <span className="ms-eyebrow">{DEMO_LABEL}</span>
        <ol className="ms-steps" aria-label="Stages">
          {["Sent", "Accepted", "Executing", "Proof", "Returned"].map((label, index) => (
            <li key={label} className={index < stageIndex ? "is-done" : index === stageIndex ? "is-current" : ""}>
              {label}
            </li>
          ))}
        </ol>
      </header>

      <div className="ms-loop__grid">
        <div className="ms-determination">
          <p className="ms-determination__intent">“{state.intent || FLAGSHIP.intent}”</p>
          <dl>
            <div>
              <dt>capability</dt>
              <dd>{FLAGSHIP.determination.capability}</dd>
            </div>
            <div>
              <dt>execution</dt>
              <dd>{FLAGSHIP.determination.execution}</dd>
            </div>
            <div>
              <dt>location</dt>
              <dd>{FLAGSHIP.determination.location}</dd>
            </div>
            <div>
              <dt>proof</dt>
              <dd>{FLAGSHIP.determination.proof.join(" · ")}</dd>
            </div>
          </dl>
          <p className="ms-determination__status">
            {stage === "matching" && "Finding an executor within range…"}
            {stage === "accepted" && (
              <>
                <Check aria-hidden="true" /> <b>{FLAGSHIP.executor.name}</b> accepted · {FLAGSHIP.executor.rating} · {FLAGSHIP.executor.distanceKm} km away
              </>
            )}
            {stage === "executing" && (
              <>
                <b>{FLAGSHIP.executor.name}</b> is on site. Photographs and video are being captured now.
              </>
            )}
            {stage === "proof" && "Proof is returning to your Muse."}
            {stage === "returned" && (
              <>
                <ShieldCheck aria-hidden="true" /> Proof received. Your Muse knows something it could not have known alone.
              </>
            )}
          </p>
        </div>

        {reality && (
          <figure className="ms-reality" aria-label="From the location">
            <MotionVideo
              asset={stage === "executing" ? FLAGSHIP.media.onsite : FLAGSHIP.media.proof}
              className="ms-reality__video"
              label={stage === "executing" ? "Executor on site with the vehicle" : "Proof being captured"}
              eager
            />
            <div className="ms-reality__stills">
              {FLAGSHIP.media.stills.map((still) => (
                <img key={still.src} src={still.src} alt={still.alt} loading="lazy" />
              ))}
            </div>
            <figcaption>
              <span>{FLAGSHIP.determination.location}</span>
              <span>{stage === "executing" ? "Inspecting · 4 / 6 checks" : "Uploading originals"}</span>
            </figcaption>
          </figure>
        )}

        {returned && (
          <div className="ms-findings">
            <ul>
              {FLAGSHIP.findings.map((finding) => (
                <li key={finding.label} className={finding.signal ? "is-signal" : ""}>
                  <span>{finding.label}</span>
                  <b>{finding.value}</b>
                </li>
              ))}
            </ul>
            <p className="ms-findings__result">{FLAGSHIP.result}</p>
            <p className="ms-findings__payment">
              {FLAGSHIP.payment.amount} {FLAGSHIP.payment.currency} paid to {FLAGSHIP.executor.name} · {FLAGSHIP.payment.rail} settlement · signed claim
            </p>
          </div>
        )}
      </div>

      {returned && (
        <footer className="ms-loop__foot">
          <button type="button" className="ms-button ms-button--signal" onClick={() => onPublish(draftFor(continuation, state.intent))}>
            {publishLabel} <ArrowUpRight aria-hidden="true" />
          </button>
          <button type="button" className="ms-button ms-button--quiet" onClick={loop.replay}>
            <RotateCcw aria-hidden="true" /> Replay
          </button>
          <button type="button" className="ms-button ms-button--quiet" onClick={loop.reset}>
            Try another power
          </button>
        </footer>
      )}
    </section>
  );
}
