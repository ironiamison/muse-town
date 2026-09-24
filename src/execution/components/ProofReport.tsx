import { Check, MapPin, ShieldCheck } from "lucide-react";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";

const evidence = [
  { asset: PHYSICAL_ASSETS.heroVehicle, label: "Exterior / front bodywork", index: "01" },
  { asset: PHYSICAL_ASSETS.interior, label: "Executor / garage", index: "02" },
  { asset: PHYSICAL_ASSETS.emblem, label: "Engine / fluid check", index: "03" },
  { asset: PHYSICAL_ASSETS.dashboard, label: "Controls / system reading", index: "04" },
] as const;

export default function ProofReport() {
  return (
    <div className="proof-report">
      <header className="proof-report__head">
        <div>
          <small>Execution #01842 · product demonstration</small>
          <h2>Proof,<br />not promises.</h2>
        </div>
        <dl>
          <div><dt>Identity</dt><dd><Check /> Verified</dd></div>
          <div><dt>Location</dt><dd><MapPin /> Verified</dd></div>
          <div><dt>Timestamp</dt><dd><Check /> Verified</dd></div>
          <div><dt>Media</dt><dd><ShieldCheck /> Original</dd></div>
        </dl>
      </header>
      <div className="proof-report__evidence">
        {evidence.map(({ asset, label, index }) => (
          <figure key={asset.id}>
            <img src={asset.src} alt={asset.alt} />
            <figcaption><span>{index}</span><strong>{label}</strong><small>{asset.credit} · temporary licensed photo</small></figcaption>
          </figure>
        ))}
      </div>
      <div className="proof-report__counts">
        <span><strong>14</strong> photos</span>
        <span><strong>3</strong> videos</span>
        <span><strong>1</strong> report</span>
      </div>
      <section className="proof-report__result">
        <header><span>Structured result</span><strong>Vehicle condition</strong></header>
        <dl>
          <div><dt>Exterior</dt><dd>Good</dd></div>
          <div><dt>Interior</dt><dd>Excellent</dd></div>
          <div><dt>Paint</dt><dd className="is-signal">Repaint detected</dd></div>
          <div><dt>VIN</dt><dd>Match</dd></div>
          <div><dt>Cold start</dt><dd>Verified</dd></div>
          <div><dt>Undisclosed issue</dt><dd className="is-signal">Passenger door</dd></div>
        </dl>
        <footer><ShieldCheck /><span><strong>Evidence contract satisfied</strong><small>6/6 required proof groups returned</small></span></footer>
      </section>
    </div>
  );
}
