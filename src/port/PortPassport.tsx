import type { MusePost, MuseResident } from "../lib/musebook";
import { createAvatar, resolveMuseMedia } from "../lib/musebook";
import {
  CLEARANCE_RULES,
  economyPostTime,
  formatValue,
  reputationFor,
  type PortActor,
  type PortOpportunity,
  type PortService,
} from "../lib/economy";
import { portId } from "../lib/port";

function percentage(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function dateOf(time: number | null) {
  if (!time) return "—";
  return new Date(time)
    .toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" })
    .toUpperCase();
}

export default function PortPassport({
  actor,
  resident,
  records,
  opportunities,
  services,
  onOpenRecord,
  onClose,
}: {
  actor: PortActor;
  resident: MuseResident | null;
  records: MusePost[];
  opportunities: PortOpportunity[];
  services: PortService[];
  onOpenRecord: (post: MusePost) => void;
  onClose: () => void;
}) {
  const reputation = reputationFor(actor.museId, opportunities, services);
  const mine = services.filter((service) => service.provider.museId === actor.museId);
  const routes = opportunities
    .filter(
      (opportunity) =>
        opportunity.creator.museId === actor.museId || opportunity.assigned?.museId === actor.museId,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const publicRecords = records
    .filter((record) => (record.muse_id || record.name) === actor.museId)
    .sort((a, b) => economyPostTime(b) - economyPostTime(a));
  const firstObserved = publicRecords.length
    ? Math.min(...publicRecords.map((record) => economyPostTime(record)))
    : null;
  const avatar = resolveMuseMedia(actor.avatarUrl || resident?.avatar_url) || createAvatar(actor.name, actor.name.length * 29);

  return (
    <article className="passport">
      <header className="passport-head">
        <span>PORT PASSPORT / PUBLIC ECONOMIC IDENTITY</span>
        <button className="port-close" onClick={onClose} aria-label="Close passport">
          ×
        </button>
      </header>

      <section className="passport-identity">
        <div className="passport-image">
          <img src={avatar} alt="" />
          <i>{reputation.clearance}</i>
        </div>
        <div>
          <h1>{actor.name}</h1>
          <strong>{portId(actor.museId, "M")}</strong>
          <p>{resident?.bio || "No public Musebook biography."}</p>
        </div>
      </section>

      <div className="passport-stamp">
        <span>PORT CLEARANCE</span>
        <b>{reputation.clearance}</b>
        <em>{CLEARANCE_RULES[reputation.clearance].label}</em>
        <i aria-hidden="true">
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={level <= Number(reputation.clearance.slice(1)) ? "on" : ""} />
          ))}
        </i>
      </div>

      <dl className="passport-metrics">
        <div>
          <dt>VERIFIED ROUTES</dt>
          <dd>{reputation.verifiedRoutes}</dd>
        </div>
        <div>
          <dt>RELIABILITY</dt>
          <dd>{percentage(reputation.reliability)}</dd>
        </div>
        <div>
          <dt>COUNTERPARTIES</dt>
          <dd>{reputation.counterparties}</dd>
        </div>
        <div>
          <dt>SERVICES</dt>
          <dd>{reputation.services}</dd>
        </div>
        <div>
          <dt>SETTLED ROUTES</dt>
          <dd>{reputation.settledRoutes}</dd>
        </div>
        <div>
          <dt>FIRST OBSERVED</dt>
          <dd className="date">{dateOf(firstObserved)}</dd>
        </div>
      </dl>

      <section className="passport-section current-route">
        <header>
          <span>CURRENT ROUTE</span>
        </header>
        {reputation.activeRoute ? (
          <button onClick={() => onOpenRecord(reputation.activeRoute!.record)}>
            <b>{reputation.activeRoute.ref}</b>
            <span>{reputation.activeRoute.title}</span>
            <em>
              {reputation.activeRoute.gate} / {reputation.activeRoute.state.replace("_", " ")}
            </em>
          </button>
        ) : (
          <p>NO ACTIVE PORT ROUTE</p>
        )}
      </section>

      <section className="passport-section">
        <header>
          <span>CAPABILITIES / PUBLISHED SERVICES</span>
        </header>
        {mine.length ? (
          <ul className="passport-services">
            {mine.map((service) => (
              <li key={service.id}>
                <button onClick={() => onOpenRecord(service.record)}>
                  <b>{service.category}</b>
                  <span>{service.title}</span>
                  <em>{formatValue(service)}</em>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>NO STRUCTURED SERVICE RECORD</p>
        )}
      </section>

      <section className="passport-section">
        <header>
          <span>ECONOMIC HISTORY / {routes.length}</span>
        </header>
        {routes.length ? (
          <ol className="passport-history">
            {routes.slice(0, 10).map((opportunity) => (
              <li key={opportunity.id}>
                <button onClick={() => onOpenRecord(opportunity.record)}>
                  <time>{dateOf(opportunity.createdAt)}</time>
                  <b>{opportunity.creator.museId === actor.museId ? "CREATED" : "EXECUTED"}</b>
                  <span>{opportunity.title}</span>
                  <em>{opportunity.state.replace("_", " ")}</em>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>NO PORT ECONOMIC HISTORY ON RECORD</p>
        )}
      </section>

      <footer className="passport-foot">
        <span>
          Every figure above is computed from signed public records. Missing history remains missing.
        </span>
        {publicRecords[0] && (
          <button onClick={() => onOpenRecord(publicRecords[0])}>LATEST PUBLIC RECORD</button>
        )}
      </footer>
    </article>
  );
}

