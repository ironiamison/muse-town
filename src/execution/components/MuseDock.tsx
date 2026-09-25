import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { MuseState } from "../../lib/muse-state";
import { MUSEVOICE_ORIGIN } from "../../lib/muse-voice";
import { POWERS } from "../../lib/powers";
import { Link } from "../router";
import StatusIndicator from "./StatusIndicator";

/**
 * Persistent Muse dock shown on product routes. The homepage renders the full
 * presence inline, so the dock is hidden there.
 */
export default function MuseDock({
  state,
  onConnect,
  onGive,
}: {
  state: MuseState;
  onConnect: () => void;
  onGive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const muse = state.muse;

  return (
    <aside className={`ms-dock ${open ? "is-open" : ""} ${muse ? "is-connected" : ""}`} aria-label="Muse dock">
      <button
        type="button"
        className="ms-dock__summary"
        onClick={() => (muse ? setOpen((value) => !value) : onConnect())}
        aria-expanded={muse ? open : undefined}
      >
        <span className="ms-dock__avatar" aria-hidden="true">
          {muse?.avatarUrl ? <img src={muse.avatarUrl} alt="" /> : <b />}
        </span>
        <span className="ms-dock__text">
          <small>{muse ? (muse.authority === "signer" ? "Connected Muse" : "Following") : "Your Muse"}</small>
          <strong>{muse ? muse.name : "Connect Muse"}</strong>
        </span>
        {muse && (
          <span className="ms-dock__counts">
            <span>{state.active.length} active</span>
            <span>{state.returned.length} proof</span>
          </span>
        )}
        {muse && <ChevronDown aria-hidden="true" />}
      </button>

      {open && muse && (
        <div className="ms-dock__panel">
          <header>
            <div>
              <small>{muse.authority === "signer" ? "Signer unlocked on this device" : "Public profile · read-only"}</small>
              <h2>{muse.name}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </header>

          <ol className="ms-dock__powers" aria-label="Powers">
            {POWERS.map((power) => (
              <li key={power.id} data-availability={state.powers[power.id].availability} className={state.used.includes(power.id) ? "is-used" : ""}>
                <b>{power.id}</b>
                <span>{state.used.includes(power.id) ? "used" : state.powers[power.id].availability.replace("_", " ")}</span>
              </li>
            ))}
          </ol>

          <section className="ms-dock__recent">
            <small>Recent</small>
            {state.mine.slice(0, 3).map((execution) => (
              <Link href={`/executions/${execution.id}`} key={`${execution.source}-${execution.id}`} onClick={() => setOpen(false)}>
                <span>
                  <strong>{execution.title}</strong>
                  <em>{execution.capability.name}</em>
                </span>
                <StatusIndicator status={execution.status} compact />
              </Link>
            ))}
            {!state.mine.length && <p>No signed execution references this Muse yet.</p>}
          </section>

          <footer>
            <button type="button" className="ms-button ms-button--signal" onClick={() => { setOpen(false); onGive(); }}>
              Give it something new
            </button>
            <Link href="/profile" onClick={() => setOpen(false)}>Profile</Link>
            {state.voice.status === "none" && (
              <a href={MUSEVOICE_ORIGIN} target="_blank" rel="noreferrer">Give it a voice</a>
            )}
          </footer>
        </div>
      )}
    </aside>
  );
}
