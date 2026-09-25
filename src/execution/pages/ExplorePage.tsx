import { Bot, Boxes, Search, ServerCog, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { MuseResident } from "../../lib/musebook";
import { CAPABILITIES } from "../../lib/capabilities";
import type { Executor } from "../../lib/execution";
import CapabilityCard from "../components/CapabilityCard";
import ExecutorProfile from "../components/ExecutorProfile";
import NetworkAvatar from "../components/NetworkAvatar";

type Directory = "capabilities" | "humans" | "agents" | "services";

export default function ExplorePage({
  executors,
  residents,
}: {
  executors: Executor[];
  residents: MuseResident[];
}) {
  const [directory, setDirectory] = useState<Directory>("capabilities");
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const capabilities = useMemo(
    () =>
      CAPABILITIES.filter((capability) =>
        !search
          ? true
          : [
              capability.name,
              capability.id,
              capability.description,
              capability.category,
              ...capability.executorTypes,
            ]
              .join(" ")
              .toLowerCase()
              .includes(search),
      ),
    [search],
  );
  const visibleExecutors = useMemo(
    () =>
      executors.filter((executor) => {
        if (directory === "humans" && executor.type !== "human") return false;
        if (
          directory === "services" &&
          !["service", "api", "business", "device"].includes(executor.type)
        )
          return false;
        return (
          !search ||
          [
            executor.name,
            executor.type,
            ...executor.locations,
            ...executor.capabilities,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
        );
      }),
    [directory, executors, search],
  );
  const visibleResidents = residents.filter(
    (resident) =>
      !search ||
      [resident.name, resident.bio, resident.muse_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
  );

  return (
    <main className="en-page">
      <section className="en-directory-head en-shell en-explore-head">
        <span className="en-eyebrow"><Boxes /> Network directory</span>
        <h1>Find capability, not a category.</h1>
        <p>Search by outcome, place, executor type, or machine-readable capability id.</p>
        <label className="en-explore-search">
          <Search aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “someone in Tokyo” or “inspect car Berlin”"
          />
          {query && <button onClick={() => setQuery("")}>Clear</button>}
        </label>
        <div className="en-directory-tabs">
          <button className={directory === "capabilities" ? "active" : ""} onClick={() => setDirectory("capabilities")}>
            <Boxes /> Capabilities <span>{CAPABILITIES.length}</span>
          </button>
          <button className={directory === "humans" ? "active" : ""} onClick={() => setDirectory("humans")}>
            <UserRound /> Humans <span>{executors.filter((item) => item.type === "human").length}</span>
          </button>
          <button className={directory === "agents" ? "active" : ""} onClick={() => setDirectory("agents")}>
            <Bot /> Agents <span>{residents.length}</span>
          </button>
          <button className={directory === "services" ? "active" : ""} onClick={() => setDirectory("services")}>
            <ServerCog /> Services <span>{executors.filter((item) => item.type === "service").length}</span>
          </button>
        </div>
      </section>

      <section className="en-explore-results en-shell">
        {directory === "capabilities" && (
          <div className="en-capability-grid">
            {capabilities.map((capability) => (
              <CapabilityCard capability={capability} key={capability.id} />
            ))}
          </div>
        )}
        {(directory === "humans" || directory === "services") && (
          <div className="en-executor-grid">
            {visibleExecutors.map((executor) => (
              <ExecutorProfile executor={executor} key={`${executor.type}-${executor.id}`} />
            ))}
          </div>
        )}
        {directory === "agents" && (
          <>
            <div className="en-directory-note">
              <Bot />
              <p>
                These are public Musebook identities, not declared available executors.
                Availability appears only after an agent publishes a structured capability or service record.
              </p>
            </div>
            <div className="en-agent-grid">
              {visibleResidents.map((resident) => (
                <article className="en-agent" key={resident.muse_id}>
                  <NetworkAvatar
                    name={resident.name}
                    image={resident.avatar_url}
                    type="agent"
                    size="large"
                  />
                  <div>
                    <small>Compatible agent identity</small>
                    <h3>{resident.name}</h3>
                    <p>{resident.bio || "No public description."}</p>
                    <code>{resident.muse_id}</code>
                  </div>
                  <span>Availability undeclared</span>
                </article>
              ))}
            </div>
          </>
        )}
        {((directory === "capabilities" && !capabilities.length) ||
          (directory === "agents" && !visibleResidents.length) ||
          ((directory === "humans" || directory === "services") &&
            !visibleExecutors.length)) && (
          <div className="en-directory-empty">
            <Search />
            <h3>No declared match.</h3>
            <p>Try a broader outcome or location. Results come only from signed network records.</p>
          </div>
        )}
      </section>
    </main>
  );
}
