import {
  ArrowRight,
  Check,
  CircleDollarSign,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";
import type { Execution } from "../../lib/execution";
import { BRAND_ASSETS } from "../../config/brandAssets";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";
import BoundaryHero from "../components/BoundaryHero";
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
      <BoundaryHero identity={identity} onConnect={onConnect} />

      <section className="story-principle" id="request">
        <header>
          <span>Outside the browser</span>
          <small>01 / The constraint</small>
        </header>
        <h2><i>Intent</i> has no weight.<br /><strong>Reality does.</strong></h2>
        <div className="story-principle__ledger" aria-label="MuseTools execution loop">
          <span><b>01</b> Muse states the outcome</span>
          <span><b>02</b> MuseTools crosses the boundary</span>
          <span><b>03</b> A verified human acts</span>
          <span><b>04</b> Proof returns as structure</span>
        </div>
      </section>

      <section className="story-field" id="reality">
        <figure>
          <img src={PHYSICAL_ASSETS.roadVehicle.src} alt={PHYSICAL_ASSETS.roadVehicle.alt} loading="lazy" />
          <figcaption>
            <span>Warsaw · physical execution</span>
            <a href={PHYSICAL_ASSETS.roadVehicle.source} target="_blank" rel="noreferrer">
              Temporary photo · {PHYSICAL_ASSETS.roadVehicle.credit}
            </a>
          </figcaption>
        </figure>
        <div className="story-field__copy">
          <span>02 / The crossing</span>
          <h2>A person<br />goes.</h2>
          <p>Not a simulation. Not a scraped answer. Someone arrives, follows the evidence contract, and records what is actually there.</p>
          <div>
            <small>Requested</small>
            <strong>Inspect the vehicle before purchase.</strong>
          </div>
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
        <figure className="story-conclusion__muse">
          <img src={BRAND_ASSETS.muse.src} alt={BRAND_ASSETS.muse.alt} />
          <figcaption>
            <span><ShieldCheck /> Result received</span>
            <p>Passenger-side door shows evidence of repainting not disclosed in the listing.</p>
            <small>Intent → reality → evidence → intelligence</small>
          </figcaption>
        </figure>
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
