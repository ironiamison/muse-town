import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "../router";

/**
 * Site-wide guided tour. Steps can live on different routes; the tour
 * navigates, waits for the target to mount, spotlights it, and keeps the
 * spotlighted element interactive so people can try things mid-tour.
 */
export type TourStep = {
  id: string;
  path: string;
  /** data-tour attribute value to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Optional hint rendered under the body. */
  hint?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "presence",
    path: "/",
    target: "presence",
    title: "This is your Muse.",
    body: "Everything on MuseTools happens to it. Connect one and this card shows its real name, avatar, powers it has used, and proof that has come back.",
    hint: "Until you connect, it reads as a placeholder — never a fake identity.",
  },
  {
    id: "powers",
    path: "/",
    target: "powers",
    title: "Six powers. Pick one.",
    body: "GO, SEE, GET, VERIFY, USE, PAY — capabilities beyond the Muse's own computer. Selecting one attaches it to the Muse and completes the sentence.",
    hint: "Try it now: press GO, then “inspect a vehicle”, then Send from Muse. The example execution plays and is labeled as an example.",
  },
  {
    id: "catalog",
    path: "/",
    target: "catalog",
    title: "Everything it can be given.",
    body: "Each continuation maps to a callable capability with a proof contract. Live means the signed protocol works today; preview and not configured are stated plainly.",
  },
  {
    id: "network",
    path: "/",
    target: "network",
    title: "Only signed records.",
    body: "This feed is read from the MuseTools ledger — signed records anyone can mirror and audit. When the network is quiet it says so. Nothing here is invented to look busy.",
  },
  {
    id: "power-list",
    path: "/capabilities",
    target: "power-list",
    title: "Powers map to capabilities.",
    body: "Below this, the catalog exposes inputs, outputs, proof types, and a machine schema for every capability a Muse can call.",
  },
  {
    id: "humans",
    path: "/humans",
    target: "humans",
    title: "Humans are one capability.",
    body: "When a Muse must be somewhere, a nearby person executes under a signed contract and returns original evidence. The Muse pays them directly — no custody, no escrow.",
    hint: "People who want to execute have their own path further down this page.",
  },
  {
    id: "proof",
    path: "/activity",
    target: "proof",
    title: "Proof is a system property.",
    body: "Every completed execution returns a proof capsule stating, check by check, what is verified, what is signed, and what is only claimed.",
  },
  {
    id: "connector",
    path: "/developers",
    target: "connector",
    title: "Connect a Muse by descriptor.",
    body: "A Muse adds MuseTools as a custom connector from one URL, reads the OpenAPI spec, and signs requests with its own key. MuseTools never holds Meta credentials.",
  },
  {
    id: "connect",
    path: "/",
    target: "connect",
    title: "Make it yours.",
    body: "Ask your Muse to connect, follow a public Muse by ID, unlock a signer on this device, or import an encrypted vault. Browsing needs none of this.",
    hint: "You're done. Give your Muse a power.",
  },
];

const TOUR_KEY = "musetools.tour.v1";

export function tourSeen() {
  try {
    return localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {
    /* ignore */
  }
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 10;

export default function SiteTour({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (next: number) => void;
  onClose: () => void;
}) {
  const current = TOUR_STEPS[step];
  const [rect, setRect] = useState<Rect | null>(null);
  const [measuring, setMeasuring] = useState(true);
  const targetRef = useRef<Element | null>(null);
  const last = step === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    const element = targetRef.current;
    if (!element || !element.isConnected) {
      setRect(null);
      return;
    }
    const box = element.getBoundingClientRect();
    setRect({ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 });
  }, []);

  // Navigate if needed, then wait for the target to mount.
  useEffect(() => {
    let cancelled = false;
    setMeasuring(true);
    setRect(null);
    targetRef.current = null;
    if (window.location.pathname.replace(/\/+$/, "") !== current.path.replace(/\/+$/, "")) {
      navigate(current.path);
    }
    const started = Date.now();
    const poll = () => {
      if (cancelled) return;
      const element = document.querySelector(`[data-tour="${current.target}"]`);
      if (element) {
        targetRef.current = element;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center", inline: "nearest" });
        window.setTimeout(() => {
          if (cancelled) return;
          measure();
          setMeasuring(false);
        }, reduced ? 50 : 420);
        return;
      }
      if (Date.now() - started > 2500) {
        setMeasuring(false);
        return;
      }
      window.setTimeout(poll, 60);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [current.path, current.target, measure]);

  useEffect(() => {
    let frame = 0;
    const onChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && !last) onStep(step + 1);
      if (event.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose, onStep, step]);

  const finish = () => {
    markTourSeen();
    onClose();
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 900;
  const cardStyle: React.CSSProperties | undefined = (() => {
    if (mobile || !rect) return undefined;
    const width = 360;
    const below = rect.top + rect.height + 14;
    const above = rect.top - 14;
    const left = Math.min(Math.max(16, rect.left), vw - width - 16);
    if (vh - below > 240) return { top: below, left, width };
    if (above > 240) return { bottom: vh - above, left, width };
    // Fall back to the right side, then to the target's own bottom-right
    // corner (the spotlight stays interactive, so overlapping is acceptable).
    const right = rect.left + rect.width + 14;
    if (vw - right > width + 16) return { top: Math.max(16, rect.top), left: right, width };
    return {
      top: Math.min(vh - 16, rect.top + rect.height) - 16,
      left: Math.min(vw - width - 16, rect.left + rect.width - width - 16),
      width,
      transform: "translateY(-100%)",
    };
  })();

  return (
    <div className={`ms-tour ${measuring ? "is-measuring" : ""}`} aria-hidden={measuring}>
      {rect ? (
        <>
          <div className="ms-tour__panel" style={{ top: 0, left: 0, width: "100%", height: Math.max(0, rect.top) }} />
          <div className="ms-tour__panel" style={{ top: rect.top + rect.height, left: 0, width: "100%", height: Math.max(0, vh - rect.top - rect.height) }} />
          <div className="ms-tour__panel" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          <div className="ms-tour__panel" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, vw - rect.left - rect.width), height: rect.height }} />
          <div className="ms-tour__ring" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />
        </>
      ) : (
        <div className="ms-tour__panel" style={{ inset: 0 }} />
      )}

      <section
        className={`ms-tour__card ${mobile ? "is-sheet" : ""}`}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="ms-tour-title"
        aria-live="polite"
      >
        <header>
          <span className="ms-eyebrow"><Compass aria-hidden="true" /> Tour · {step + 1} / {TOUR_STEPS.length}</span>
          <button type="button" onClick={finish} aria-label="Close tour"><X aria-hidden="true" /></button>
        </header>
        <h2 id="ms-tour-title">{current.title}</h2>
        <p>{current.body}</p>
        {current.hint && <p className="ms-tour__hint">{current.hint}</p>}
        <footer>
          <ol className="ms-tour__dots" aria-hidden="true">
            {TOUR_STEPS.map((item, index) => (
              <li key={item.id} className={index === step ? "is-current" : index < step ? "is-done" : ""} />
            ))}
          </ol>
          <div>
            {step > 0 && (
              <button type="button" className="ms-button ms-button--quiet" onClick={() => onStep(step - 1)}>
                <ArrowLeft aria-hidden="true" /> Back
              </button>
            )}
            {last ? (
              <button type="button" className="ms-button ms-button--signal" onClick={finish}>
                Finish
              </button>
            ) : (
              <button type="button" className="ms-button ms-button--signal" onClick={() => onStep(step + 1)}>
                Next <ArrowRight aria-hidden="true" />
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function TourInvite({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <aside className="ms-tour-invite" role="status">
      <Compass aria-hidden="true" />
      <span>
        <strong>New here?</strong>
        <small>A 60-second tour of what your Muse can gain.</small>
      </span>
      <button type="button" className="ms-button ms-button--signal" onClick={onStart}>Start</button>
      <button type="button" className="ms-tour-invite__skip" onClick={onDismiss} aria-label="Dismiss">
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
