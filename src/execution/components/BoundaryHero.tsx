import { ArrowRight, Check, MapPin, RotateCcw, ShieldCheck } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BRAND_ASSETS } from "../../config/brandAssets";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";
import type { MuseIdentity } from "../../lib/musebook";

type Phase = "ready" | "crossing" | "matched" | "onsite" | "proof" | "complete";

const PHASE_ORDER: Phase[] = ["ready", "crossing", "matched", "onsite", "proof", "complete"];
const PHASE_LABEL: Record<Phase, string> = {
  ready: "Intent staged",
  crossing: "Crossing into reality",
  matched: "Executor accepted",
  onsite: "Executor on site",
  proof: "Proof returning",
  complete: "Result received",
};

const REQUESTS = [
  {
    short: "Inspect this Porsche before I buy it.",
    title: "Inspect this Porsche before I buy it.",
    result: "Passenger-side door shows evidence of repainting not disclosed in the listing.",
    asset: PHYSICAL_ASSETS.dealership,
    evidence: [PHYSICAL_ASSETS.heroVehicle, PHYSICAL_ASSETS.roadVehicle, PHYSICAL_ASSETS.interior, PHYSICAL_ASSETS.dashboard],
    report: [
      ["Exterior", "Good"],
      ["Interior", "Excellent"],
      ["Paint", "Repaint detected"],
      ["VIN", "Match"],
      ["Cold start", "Verified"],
      ["Undisclosed issue", "Passenger-side door"],
    ],
  },
  {
    short: "Walk through this apartment.",
    title: "Walk through this apartment before I sign.",
    result: "Moisture damage is visible below the north-facing bedroom window.",
    asset: PHYSICAL_ASSETS.apartmentInspection,
    evidence: Array(4).fill(PHYSICAL_ASSETS.apartmentInspection),
    report: [
      ["Windows", "Operational"],
      ["Utilities", "Active"],
      ["Measurements", "62.4 m²"],
      ["Address", "Match"],
      ["Moisture", "Detected"],
      ["Undisclosed issue", "Bedroom window"],
    ],
  },
  {
    short: "Check if this item is in stock.",
    title: "Check whether this item is physically in stock.",
    result: "Two units are available on shelf B-14; the listed color is not present.",
    asset: PHYSICAL_ASSETS.storeInventory,
    evidence: Array(4).fill(PHYSICAL_ASSETS.storeInventory),
    report: [
      ["Item", "Located"],
      ["Quantity", "2 units"],
      ["Shelf", "B-14"],
      ["Barcode", "Match"],
      ["Listed color", "Unavailable"],
      ["Media", "Original"],
    ],
  },
  {
    short: "Pick this up and deliver it.",
    title: "Pick this up and deliver it before 18:00.",
    result: "Item collected intact and delivered to the verified destination at 17:42.",
    asset: PHYSICAL_ASSETS.packageDelivery,
    evidence: Array(4).fill(PHYSICAL_ASSETS.packageDelivery),
    report: [
      ["Pickup", "Verified"],
      ["Package", "Intact"],
      ["Recipient", "Matched"],
      ["Destination", "Verified"],
      ["Delivered", "17:42"],
      ["Proof", "Original media"],
    ],
  },
] as const;

function reached(phase: Phase, target: Phase) {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target);
}

export default function BoundaryHero({
  identity,
  onConnect,
}: {
  identity: MuseIdentity | null;
  onConnect: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const timers = useRef<number[]>([]);
  const request = REQUESTS[selected];

  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  const dispatch = (index = selected) => {
    clearTimers();
    setSelected(index);
    setPhase("ready");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("complete");
      return;
    }
    ([
      [80, "crossing"],
      [900, "matched"],
      [1650, "onsite"],
      [2450, "proof"],
      [3300, "complete"],
    ] as const).forEach(([delay, next]) => {
      timers.current.push(window.setTimeout(() => setPhase(next), delay));
    });
  };

  useEffect(() => () => clearTimers(), []);

  return (
    <section className={`boundary-hero is-${phase}`} aria-label="MuseTools execution demonstration">
      <div className="boundary-hero__digital">
        <div className="boundary-hero__intro">
          <p>AI can browse it.<br />AI can call it.<br />Now it can go there.</p>
          <h1>Ask for<br />something<br />it can’t do.</h1>
          <div className="boundary-hero__requests" aria-label="Example physical requests">
            {REQUESTS.map((item, index) => (
              <button
                type="button"
                className={selected === index ? "active" : ""}
                key={item.short}
                onClick={() => dispatch(index)}
                aria-pressed={selected === index}
              >
                <ArrowRight />
                <span>{item.short}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="boundary-hero__physical">
        <img className="boundary-hero__reality-base" src={request.asset.src} alt={request.asset.alt} />
        <img className="boundary-hero__reality-reveal" src={request.asset.src} alt="" aria-hidden="true" />
        <div className="boundary-hero__photo-shade" />
        <a href={request.asset.source} target="_blank" rel="noreferrer">
          Temporary photo · {request.asset.credit}
        </a>
      </div>

      <div className="boundary-hero__world-labels" aria-hidden="true">
        <span>Digital<br /><i>(Muse)</i></span>
        <span>Physical<br /><i>(Real world)</i></span>
      </div>

      <div className="boundary-hero__seam" aria-hidden="true">
        <i /><i /><i /><i /><i />
        <strong>MUSETOOLS</strong>
      </div>

      <div className="boundary-hero__muse">
        <span>
          <img
            src={identity?.avatarUrl ?? BRAND_ASSETS.muse.src}
            alt={identity?.avatarUrl ? "" : BRAND_ASSETS.muse.alt}
          />
        </span>
        <small>{identity?.name ?? "Muse"}</small>
      </div>

      <div className="boundary-hero__phase" aria-live="polite">
        <i />
        <span>{PHASE_LABEL[phase]}</span>
        <small>{phase === "ready" ? "Select a request to run the execution" : `0${PHASE_ORDER.indexOf(phase) + 1} / 06`}</small>
      </div>

      <div className="boundary-hero__intent-route" aria-hidden="true"><i /></div>

      <div className="boundary-hero__request-packet">
        <span>{request.title}</span>
        <ArrowRight />
      </div>

      <div className="boundary-hero__executor">
        <span className="boundary-hero__executor-avatar">K</span>
        <div><strong>Kasia</strong><small>1.4 km away<br />★ 4.97</small></div>
        <b><Check /> Accepted</b>
      </div>

      <ol className="boundary-hero__timeline">
        <li className={reached(phase, "matched") ? "done" : ""}><i /><span>En route<small>4 min</small></span></li>
        <li className={phase === "onsite" ? "active" : reached(phase, "proof") ? "done" : ""}><i /><span>On site<small>Inspecting</small></span></li>
        <li className={phase === "proof" ? "active" : reached(phase, "complete") ? "done" : ""}><i /><span>Collecting proof</span></li>
        <li className={phase === "complete" ? "active" : ""}><i /><span>Result verified</span></li>
      </ol>

      <div className="boundary-hero__evidence">
        {request.evidence.map(
          (asset, index) => (
            <figure key={`${asset.id}-${index}`} style={{ "--evidence-index": index } as CSSProperties}>
              <img src={asset.src} alt={asset.alt} />
              <figcaption>{index === 3 ? "+10" : `0${index + 1}`}</figcaption>
            </figure>
          ),
        )}
      </div>

      <div className="boundary-hero__return-route" aria-hidden="true">
        <i /><span><Check /></span>
      </div>

      <div className="boundary-hero__result-card">
        <small>Result for Muse</small>
        <p>{request.result}</p>
      </div>

      <div className="boundary-hero__report">
        <header>
          <span>Verified inspection</span>
          <small><Check /> 14 photos　<Check /> 3 videos　<Check /> VIN matched　<Check /> Location verified</small>
        </header>
        <dl>
          {request.report.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd className={/issue|moisture|color|paint/i.test(label) ? "is-signal" : ""}>{value}</dd></div>
          ))}
        </dl>
      </div>

      <figure className="boundary-hero__proof-image">
        <img src={request.evidence[0].src} alt={request.evidence[0].alt} />
        <figcaption><ShieldCheck /> Evidence <small>IMG_0184.JPG · Warsaw</small></figcaption>
      </figure>

      <div className="boundary-hero__controls">
        <button type="button" onClick={() => dispatch()}><RotateCcw /> {phase === "ready" ? "Run execution" : "Replay execution"}</button>
        <button type="button" onClick={onConnect}>{identity ? `Open ${identity.name}` : "Connect Muse"} <ArrowRight /></button>
      </div>

      <div className="boundary-hero__location"><MapPin /> Warsaw · product demonstration</div>
    </section>
  );
}
