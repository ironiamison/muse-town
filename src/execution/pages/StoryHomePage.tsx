import {
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";
import type { Execution } from "../../lib/execution";
import { BRAND_ASSETS } from "../../config/brandAssets";
import { PHYSICAL_ASSETS } from "../../config/physicalAssets";
import BoundaryHero from "../components/BoundaryHero";
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
    <main className="en-page story-home story-home--seam">
      <BoundaryHero identity={identity} onConnect={onConnect} />

      <section className="seam-story" id="request" aria-label="How a MuseTools execution works">
        <article className="seam-chapter seam-chapter--dispatch">
          <div className="seam-chapter__digital">
            <header><span>02 / Dispatch</span><small>Digital intent</small></header>
            <h2>The request<br />becomes<br />a route.</h2>
            <p>Muse states the outcome. MuseTools finds a verified person close enough and qualified to act.</p>
            <button type="button" onClick={onCreateTask}>Create a real task <ArrowRight /></button>
          </div>
          <figure className="seam-chapter__physical">
            <img src={PHYSICAL_ASSETS.dealership.src} alt={PHYSICAL_ASSETS.dealership.alt} loading="lazy" />
            <figcaption><MapPin /> Warsaw · 1.4 km</figcaption>
          </figure>
          <div className="seam-ticket">
            <span><small>Request</small><strong>Inspect before purchase</strong></span>
            <span><small>Executor</small><strong>Kasia · 4.97</strong></span>
            <span><small>Network</small><strong>{publishedHumans > 0 ? `${publishedHumans} published` : "Demo pool"}</strong></span>
            <b><Check /> Accepted</b>
          </div>
        </article>

        <article className="seam-chapter seam-chapter--onsite" id="execution">
          <div className="seam-chapter__digital">
            <header><span>03 / On site</span><small>Physical execution</small></header>
            <h2>Someone<br />actually<br />goes.</h2>
            <p>No simulation and no scraped answer. The executor follows a precise evidence contract in the physical world.</p>
            <ol className="seam-progress">
              <li className="done"><i />Accepted <small>18:44</small></li>
              <li className="done"><i />Arrived <small>14:02</small></li>
              <li className="active"><i />Inspecting <small>4 / 6</small></li>
              <li><i />Proof <small>Pending</small></li>
            </ol>
          </div>
          <figure className="seam-chapter__physical">
            <img src={PHYSICAL_ASSETS.interior.src} alt={PHYSICAL_ASSETS.interior.alt} loading="lazy" />
            <figcaption><span>Original capture</span><small>Executor / garage</small></figcaption>
          </figure>
          <div className="seam-ticket seam-ticket--evidence">
            {[PHYSICAL_ASSETS.heroVehicle, PHYSICAL_ASSETS.roadVehicle, PHYSICAL_ASSETS.dashboard].map((asset, index) => (
              <figure key={asset.id}>
                <img src={asset.src} alt={asset.alt} loading="lazy" />
                <figcaption>0{index + 1}</figcaption>
              </figure>
            ))}
            <span><small>Evidence contract</small><strong>Location · VIN · paint · cold start</strong></span>
          </div>
        </article>

        <article className="seam-chapter seam-chapter--proof" id="proof">
          <div className="seam-chapter__digital">
            <header><span>04 / Return</span><small>Structured proof</small></header>
            <h2>Reality<br />comes back<br />useful.</h2>
            <div className="seam-result">
              <span><ShieldCheck /> Result received</span>
              <p>Passenger-side door shows evidence of repainting not disclosed in the listing.</p>
            </div>
          </div>
          <figure className="seam-chapter__physical">
            <img src={PHYSICAL_ASSETS.emblem.src} alt={PHYSICAL_ASSETS.emblem.alt} loading="lazy" />
            <figcaption><span>IMG_0184.JPG</span><small>Original media · Warsaw</small></figcaption>
          </figure>
          <div className="seam-ticket seam-ticket--report">
            <span><small>Identity</small><strong>Verified</strong></span>
            <span><small>Location</small><strong>Verified</strong></span>
            <span><small>VIN</small><strong>Match</strong></span>
            <span className="signal"><small>Paint</small><strong>Repaint detected</strong></span>
            <b><Check /> Proof verified</b>
          </div>
        </article>
      </section>

      <section className="seam-outro">
        <figure className="seam-outro__muse">
          <img src={BRAND_ASSETS.muse.src} alt={BRAND_ASSETS.muse.alt} />
          <figcaption>
            <small>Muse / digital</small>
            <strong>{identity?.name ?? "Ready for the next request"}</strong>
          </figcaption>
        </figure>
        <div className="seam-outro__cta">
          <span>05 / Loop complete</span>
          <h2>Your Muse<br />just left the<br />internet.</h2>
          <p>Intent crossed out. Verified reality came back.</p>
          <button type="button" onClick={onConnect}>{identity ? `Open ${identity.name}` : "Connect Muse"} <ArrowRight /></button>
          {live && (
            <Link className="seam-live" href={`/executions/${live.id}`}>
              <span>Live signed record</span>
              <strong>{live.title}</strong>
              <small>{live.id} · {live.status}</small>
              <ArrowRight />
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
