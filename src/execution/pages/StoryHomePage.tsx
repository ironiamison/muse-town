import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleDollarSign,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";
import type { Execution } from "../../lib/execution";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";
import DispatchCanvas from "../components/DispatchCanvas";
import ProofReport from "../components/ProofReport";
import RealityBoundary from "../components/RealityBoundary";
import { Link } from "../router";

export default function StoryHomePage({
  identity,
  executions,
  publishedHumans,
  onConnect,
  onCreateTask,
}: {
  identity: MuseIdentity | null;
  executions: Execution[];
  publishedHumans: number;
  onConnect: () => void;
  onCreateTask: () => void;
}) {
  const live = executions[0] ?? null;
  return (
    <main className="en-page story-home">
      <section className="story-arrival">
        <div className="story-arrival__copy">
          <h1>Give your Muse<br />access to the<br /><em>real world.</em></h1>
          <p>Dispatch people and capabilities for things AI can’t do itself.</p>
          <div>
            <button onClick={onConnect}>{identity ? identity.name : "Connect Muse"} <ArrowRight /></button>
            <a href="#request">See it work <ArrowDown /></a>
          </div>
        </div>
        <div className="story-arrival__muse">
          <small>Muse / digital</small>
          <strong>{identity?.name ?? "Awaiting connection"}</strong>
          <i className={identity ? "active" : ""} />
        </div>
        <div className="arrival-boundary">
          <span>Digital</span>
          <i />
          <strong>MUSETOOLS</strong>
          <i />
          <span>Physical</span>
        </div>
        <div className="story-index">01 / Arrival</div>
      </section>

      <section className="story-request" id="request">
        <header>
          <span>02 / Request</span>
          <p>Muse reaches the edge of software.</p>
        </header>
        <RealityBoundary direction="outbound" image={PHYSICAL_ASSETS.heroVehicle} />
      </section>

      <section className="story-reality" id="reality">
        <img src={PHYSICAL_ASSETS.dealership.src} alt={PHYSICAL_ASSETS.dealership.alt} loading="eager" />
        <div className="story-reality__veil" />
        <div className="story-reality__copy">
          <p>AI can search it.<br />AI can call it.</p>
          <h2>AI can’t<br />go there.</h2>
          <strong>MuseTools can.</strong>
        </div>
        <div className="story-reality__meta">
          <span>03 / Reality</span>
          <span>Warsaw · 52.2297° N</span>
          <a href={PHYSICAL_ASSETS.dealership.source} target="_blank" rel="noreferrer">Temporary photo · {PHYSICAL_ASSETS.dealership.credit}</a>
        </div>
      </section>

      <section className="story-dispatch" id="dispatch">
        <header className="story-scene-head">
          <span>04 / Dispatch</span>
          <h2>Physical reach,<br />on demand.</h2>
          <p>Muse sends the outcome. MuseTools finds the capability and the human.</p>
        </header>
        <DispatchCanvas publishedHumans={publishedHumans} onCreateRealTask={onCreateTask} />
      </section>

      <section className="story-execution" id="execution">
        <div className="story-execution__timeline">
          <header><span>05 / Execution</span><small>Product demonstration</small></header>
          <ol>
            <li className="done"><i /><span><small>18:42</small><strong>Request</strong><em>Vehicle inspection issued</em></span></li>
            <li className="done"><i /><span><small>18:44</small><strong>Claimed</strong><em>Kasia · verified executor</em></span></li>
            <li className="done"><i /><span><small>Tomorrow · 14:02</small><strong>Arrived</strong><em>Location evidence received</em></span></li>
            <li className="active"><i /><span><small>14:07</small><strong>Inspecting</strong><em>Evidence contract 4/6</em></span></li>
            <li><i /><span><small>Pending</small><strong>Proof</strong><em>Structured return to Muse</em></span></li>
          </ol>
        </div>
        <figure className="story-execution__image story-execution__image--large">
          <img src={PHYSICAL_ASSETS.roadVehicle.src} alt={PHYSICAL_ASSETS.roadVehicle.alt} />
          <figcaption><span>Exterior / condition</span><small>Original media expected</small></figcaption>
        </figure>
        <figure className="story-execution__image story-execution__image--detail">
          <img src={PHYSICAL_ASSETS.interior.src} alt={PHYSICAL_ASSETS.interior.alt} />
          <figcaption><span>Interior / controls</span><small>Evidence group 04</small></figcaption>
        </figure>
        <div className="story-x402-event">
          <CircleDollarSign />
          <span><small>Capability required</small><strong>vehicle_history</strong></span>
          <i><b /></i>
          <em>$0.18</em>
          <i><b /></i>
          <span><Check /><strong>Paid via x402</strong><small>Illustrative · integration not configured</small></span>
        </div>
        <div className="story-execution__credits">
          Temporary licensed photography · {PHYSICAL_ASSETS.roadVehicle.credit} · {PHYSICAL_ASSETS.interior.credit}
        </div>
      </section>

      <section className="story-proof" id="proof">
        <ProofReport />
      </section>

      <section className="story-return" id="return">
        <header>
          <span>07 / Return</span>
          <h2>Reality becomes<br />intelligence.</h2>
        </header>
        <RealityBoundary direction="return" image={PHYSICAL_ASSETS.dashboard} />
      </section>

      <section className="story-conclusion">
        <div className="story-conclusion__result">
          <span><ShieldCheck /> Result received</span>
          <p>Passenger-side door shows evidence of repainting not disclosed in the listing.</p>
          <small>Intent → reality → evidence → intelligence</small>
        </div>
        <div className="story-conclusion__cta">
          <span>08 / Muse continues</span>
          <h2>Your Muse<br />just left<br />the internet.</h2>
          <button onClick={onConnect}>{identity ? `Open ${identity.name}` : "Connect Muse"} <ArrowRight /></button>
        </div>
      </section>

      {live && (
        <section className="story-live">
          <div>
            <span>Live signed network record</span>
            <strong>{live.title}</strong>
            <small>{live.id} · {live.status} · this item is real, unlike the labeled demonstration above</small>
          </div>
          <Link href={`/executions/${live.id}`}>Open execution <ArrowRight /></Link>
        </section>
      )}
    </main>
  );
}
