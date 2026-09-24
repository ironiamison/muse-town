import { Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PhysicalAsset } from "../../config/physicalAssets";

const stages = ["idle", "intent", "approach", "crossing", "received"] as const;
type BoundaryStage = (typeof stages)[number];

export default function RealityBoundary({
  direction,
  image,
  onComplete,
}: {
  direction: "outbound" | "return";
  image: PhysicalAsset;
  onComplete?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<BoundaryStage>("idle");
  const [run, setRun] = useState(0);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let timers: number[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = () => {
      timers.forEach(window.clearTimeout);
      timers = [];
      if (reduced) {
        setStage("received");
        onComplete?.();
        return;
      }
      setStage("idle");
      [500, 1450, 2450, 3650].forEach((delay, index) => {
        timers.push(
          window.setTimeout(() => {
            const next = stages[index + 1];
            setStage(next);
            if (next === "received") onComplete?.();
          }, delay),
        );
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.45) {
          play();
          observer.disconnect();
        }
      },
      { threshold: [0.45] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, [onComplete, run]);

  const outbound = direction === "outbound";
  return (
    <div
      ref={root}
      className={`reality-boundary is-${direction} is-${stage}`}
      data-stage={stage}
    >
      <div className="reality-boundary__digital">
        <header><span>Digital</span><small>Muse environment</small></header>
        {outbound ? (
          <div className="boundary-payload boundary-payload--request">
            <small>Intent / execution request</small>
            <strong>Inspect this Porsche before I buy it.</strong>
            <code>inspect_vehicle</code>
          </div>
        ) : (
          <div className="boundary-destination">
            <small>Muse / waiting</small>
            <strong>Objective paused</strong>
            <i />
          </div>
        )}
      </div>
      <div className="reality-boundary__gate" aria-hidden="true">
        <i />
        <span>MUSETOOLS</span>
        <i />
        <b />
      </div>
      <div className="reality-boundary__physical">
        <img src={image.src} alt={image.alt} />
        <header><span>Physical</span><small>Warsaw · verified executor network</small></header>
        {outbound ? (
          <div className="boundary-destination">
            <small>Physical task / ready</small>
            <strong>Vehicle inspection</strong>
            <i />
          </div>
        ) : (
          <div className="boundary-payload boundary-payload--proof">
            <Check />
            <span><small>Structured result</small><strong>Repaint detected · passenger door</strong><code>proof_verified</code></span>
          </div>
        )}
        <a href={image.source} target="_blank" rel="noreferrer" className="physical-credit">
          Temporary photo · {image.credit}
        </a>
      </div>
      <div className="boundary-crossing-label" aria-live="polite">
        {stage === "idle" && "System ready"}
        {stage === "intent" && (outbound ? "Intent emitted" : "Proof prepared")}
        {stage === "approach" && "Approaching boundary"}
        {stage === "crossing" && (outbound ? "Entering reality" : "Returning to Muse")}
        {stage === "received" && (outbound ? "Physical execution available" : "Result received")}
      </div>
      <button className="boundary-replay" onClick={() => setRun((value) => value + 1)}>
        <RotateCcw /> Replay crossing
      </button>
    </div>
  );
}
