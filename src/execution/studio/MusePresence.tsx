import { ArrowUpRight, Pause, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LoopStage } from "../../demo/flagship";
import type { MuseState } from "../../lib/muse-state";
import { MUSEVOICE_ORIGIN, type VoiceClip } from "../../lib/muse-voice";
import { POWERS, type PowerId } from "../../lib/powers";
import { Link } from "../router";

const STAGE_STATUS: Record<LoopStage, string> = {
  idle: "Ready",
  power: "Choosing a power",
  continuation: "Choosing a power",
  intent: "Forming a request",
  matching: "Sending request",
  accepted: "Executor accepted",
  executing: "Away in the world",
  proof: "Receiving proof",
  returned: "Knows more",
};

function VoiceControl({ clip, label }: { clip: VoiceClip; label: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = async () => {
    if (!audio.current) {
      audio.current = new Audio(clip.url);
      audio.current.preload = "none";
      audio.current.addEventListener("ended", () => setPlaying(false));
      audio.current.addEventListener("pause", () => setPlaying(false));
    }
    if (playing) {
      audio.current.pause();
      return;
    }
    try {
      await audio.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };
  return (
    <button type="button" className="ms-voice" onClick={() => void toggle()} aria-pressed={playing}>
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      <span>
        <strong>{playing ? "Playing" : "Hear your Muse"}</strong>
        <small>{label}</small>
      </span>
    </button>
  );
}

export default function MusePresence({
  state,
  stage,
  selectedPower,
  onConnect,
  onGiveSomethingNew,
}: {
  state: MuseState;
  stage: LoopStage;
  selectedPower: PowerId | null;
  onConnect: () => void;
  onGiveSomethingNew: () => void;
}) {
  const muse = state.muse;
  const status = STAGE_STATUS[stage];
  const away = stage === "executing" || stage === "proof";
  const recent = state.returned.slice(0, 2).length ? state.returned.slice(0, 2) : state.mine.slice(0, 2);
  const voiceClip = state.voice.status === "ready" ? state.voice.passport.clips[0] ?? null : null;

  return (
    <aside className={`ms-presence ${muse ? "is-connected" : ""} ${away ? "is-away" : ""} is-${stage}`} aria-label="Your Muse" data-tour="presence">
      <header className="ms-presence__head">
        <span className="ms-presence__label">{muse ? (muse.authority === "signer" ? "Connected Muse" : "Following Muse") : "Your Muse"}</span>
        <span className="ms-presence__state" data-state={stage}>
          <i aria-hidden="true" />
          {status}
        </span>
      </header>

      <div className="ms-presence__identity">
        {muse?.avatarUrl ? (
          <img src={muse.avatarUrl} alt="" className="ms-presence__avatar" />
        ) : (
          <span className="ms-presence__mark" aria-hidden="true">
            <b />
          </span>
        )}
        <h2 className="ms-presence__name">{muse ? muse.name : "Not connected yet"}</h2>
        <p className="ms-presence__sub">
          {muse
            ? muse.authority === "signer"
              ? "Signer unlocked on this device."
              : "Public profile. Connect its signer to publish."
            : "Connect a Muse to make this its home."}
        </p>
      </div>

      <ol className="ms-presence__powers" aria-label="Powers">
        {POWERS.map((power) => {
          const availability = state.powers[power.id].availability;
          const used = state.used.includes(power.id);
          const selected = selectedPower === power.id;
          const gained = selected && stage === "returned";
          const label = gained
            ? "gained"
            : selected
              ? away ? "in use" : "attaching"
              : used
                ? "used"
                : availability === "live"
                  ? "ready"
                  : availability === "preview"
                    ? "preview"
                    : "not configured";
          return (
            <li
              key={power.id}
              data-availability={availability}
              className={`${selected ? "is-selected" : ""} ${used || gained ? "is-used" : ""}`}
            >
              <b>{power.id}</b>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="ms-presence__facts">
        <span><strong>{state.active.length}</strong><small>active</small></span>
        <span><strong>{state.completed.length}</strong><small>complete</small></span>
        <span><strong>{state.returned.length}</strong><small>proof returned</small></span>
      </div>

      {muse && recent.length > 0 && (
        <ul className="ms-presence__recent" aria-label="Recent">
          {recent.map((execution) => (
            <li key={`${execution.source}-${execution.id}`}>
              <Link href={`/executions/${execution.id}`}>
                <span>{execution.title}</span>
                <small>{execution.status.toLowerCase().replace("_", " ")}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {muse && !recent.length && (
        <p className="ms-presence__empty">No signed execution references this Muse yet.</p>
      )}

      {muse && voiceClip && (
        <VoiceControl clip={voiceClip} label={voiceClip.label ?? "Signed MuseVoice clip"} />
      )}
      {muse && state.voice.status === "none" && (
        <a className="ms-presence__voice-link" href={MUSEVOICE_ORIGIN} target="_blank" rel="noreferrer">
          Give it a voice <ArrowUpRight aria-hidden="true" />
        </a>
      )}

      {muse ? (
        <button type="button" className="ms-presence__cta" onClick={onGiveSomethingNew}>
          <Plus aria-hidden="true" /> Give it something new
        </button>
      ) : (
        <button type="button" className="ms-presence__cta" onClick={onConnect}>
          Connect Muse
        </button>
      )}
    </aside>
  );
}
