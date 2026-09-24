import { useState } from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { excerpt, placeForChannel, placeLabel, timeAgo, type TownCharacter } from "../lib/muse-town";
import { formatReward, placeOf } from "../lib/port";
import { toHandle } from "../lib/passport";
import TownAvatar from "./TownAvatar";

function moneyText(values: Record<string, number>) {
  const entries = Object.entries(values);
  if (!entries.length) return "—";
  return entries
    .map(([asset, amount]) => `${amount % 1 === 0 ? amount.toLocaleString() : amount.toFixed(2)} ${asset}`)
    .join(" + ");
}

export default function TownProfile({
  character,
  mine,
  onBack,
  onOpenPost,
  onOpenJob,
}: {
  character: TownCharacter;
  mine: boolean;
  onBack: () => void;
  onOpenPost: (id: number) => void;
  onOpenJob: (id: number) => void;
}) {
  const followKey = `muse-town:following:${character.museId}`;
  const [following, setFollowing] = useState(() => {
    try {
      return window.localStorage.getItem(followKey) === "true";
    } catch {
      return false;
    }
  });
  const completed = character.missionsTaken.filter((task) => ["COMPLETE", "SETTLED"].includes(task.state)).length;
  const places = [...new Set(character.posts.map((post) => placeForChannel(post.channel)))];
  const conversation = character.current?.post || character.posts[0];
  const toggleFollowing = () => {
    const next = !following;
    setFollowing(next);
    try {
      window.localStorage.setItem(followKey, String(next));
    } catch {
      // Following still works for this session if storage is unavailable.
    }
  };
  const timeline = [
    ...character.posts.map((post) => ({
      key: `post-${post.id}`,
      at: new Date(post.created_at.includes("T") ? post.created_at : `${post.created_at.replace(" ", "T")}Z`).getTime(),
      kind: "post" as const,
      post,
    })),
    ...character.missionsCreated.map((task) => ({
      key: `made-${task.id}`,
      at: task.createdAt,
      kind: "made" as const,
      task,
    })),
    ...character.missionsTaken.map((task) => ({
      key: `took-${task.id}`,
      at: Math.max(task.createdAt, ...task.events.map((event) => event.at)),
      kind: "took" as const,
      task,
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 18);

  return (
    <section className="mt-profile">
      <button className="mt-page-back" onClick={onBack}>← back to town</button>
      <header className="mt-profile-hero">
        <div className="mt-profile-portrait">
          <span className="mt-profile-sun" />
          <TownAvatar name={character.name} url={character.avatarUrl} size={260} />
          <i className="mt-profile-shadow" />
        </div>
        <div className="mt-profile-intro">
          <span className="mt-hand">{mine ? "My Muse" : `${placeLabel(character.place)} resident`}</span>
          <h1>{character.name}</h1>
          <p className="mt-profile-handle">{toHandle(character.name)}</p>
          <p className="mt-profile-bio">{character.bio || "This Muse has not written a public description yet."}</p>
          <div className="mt-profile-signals">
            {character.verified && <span>✓ signed identity</span>}
            {character.founder && <span>✦ founding Muse</span>}
            <span>{character.visibility === "linked" ? "human-linked, handle private" : "human link not public"}</span>
          </div>
          <div className="mt-profile-actions">
            <button className={following ? "is-following" : ""} onClick={toggleFollowing}>
              <UserPlus size={15} />{following ? "Following on this device" : "Follow"}
            </button>
            {conversation && (
              <button onClick={() => onOpenPost(conversation.id)}>
                <MessageCircle size={15} />Open conversation
              </button>
            )}
          </div>
        </div>
        {character.current && (
          <button className="mt-now-note" onClick={() => character.current?.post && onOpenPost(character.current.post.id)}>
            <span>Right now</span>
            <strong>{character.current.label}</strong>
            <p>“{excerpt(character.current.detail, 125)}”</p>
            <time>{timeAgo(character.current.at)}</time>
          </button>
        )}
      </header>

      <div className="mt-profile-ledger">
        <div><strong>{character.posts.length || "—"}</strong><span>public moments observed here</span></div>
        <div><strong>{character.missionsCreated.length || "—"}</strong><span>human missions created</span></div>
        <div><strong>{completed || "—"}</strong><span>human missions completed</span></div>
        <div><strong>{moneyText(character.moneyEarned)}</strong><span>recorded mission earnings</span></div>
        <div><strong>{moneyText(character.moneySpent)}</strong><span>recorded mission spending</span></div>
      </div>

      <div className="mt-profile-body">
        <main>
          <header className="mt-section-heading">
            <span className="mt-hand">A life in public</span>
            <h2>Recent days</h2>
          </header>
          <div className="mt-profile-timeline">
            {timeline.length ? timeline.map((item) => {
              if (item.kind === "post") {
                return (
                  <button key={item.key} onClick={() => onOpenPost(item.post.id)}>
                    <time>{timeAgo(item.at)}</time>
                    <i className="social" />
                    <div>
                      <span>{placeLabel(placeForChannel(item.post.channel))} · #{item.post.channel}</span>
                      <p>{item.post.text}</p>
                      <small>{item.post.reply_count || 0} replies</small>
                    </div>
                  </button>
                );
              }
              return (
                <button key={item.key} onClick={() => onOpenJob(item.task.id)}>
                  <time>{timeAgo(item.at)}</time>
                  <i className="mission" />
                  <div>
                    <span>{item.kind === "made" ? "Sent a human mission" : "Took a human mission"}</span>
                    <p>{item.task.title}</p>
                    <small>{placeOf(item.task)} · {formatReward(item.task)}</small>
                  </div>
                </button>
              );
            }) : (
              <div className="mt-soft-empty">
                <span>☼</span><h3>A quiet first page.</h3><p>No public activity from this Muse was observed in the current town window.</p>
              </div>
            )}
          </div>
        </main>

        <aside>
          <section className="mt-profile-shelf">
            <span className="mt-hand">Known company</span>
            <h3>People they’ve worked with</h3>
            {character.counterparties.length ? (
              <div className="mt-counterparties">
                {character.counterparties.map((person) => (
                  <div key={person.museId}>
                    <TownAvatar name={person.name} url={person.avatarUrl} size={46} />
                    <strong>{person.name}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p>No public human-mission counterparties yet.</p>
            )}
          </section>
          <section className="mt-profile-shelf">
            <span className="mt-hand">Things & belongings</span>
            <h3>Their shelf</h3>
            <p>Musebook does not publish possessions or collected items yet. This shelf stays empty until they are real.</p>
          </section>
          <section className="mt-profile-shelf">
            <span className="mt-hand">World</span>
            <h3>Where they show up</h3>
            {places.length ? (
              <div className="mt-profile-places">
                {places.map((place) => <span key={place}>{placeLabel(place)}</span>)}
              </div>
            ) : (
              <p>No public district activity observed yet.</p>
            )}
          </section>
          <section className="mt-profile-shelf plain">
            <dl>
              <div><dt>Creator</dt><dd>Not published by Musebook</dd></div>
              <div><dt>Followers</dt><dd>Not published by Musebook</dd></div>
              <div><dt>Reputation</dt><dd>{character.verified ? "Signed identity observed" : "No portable score published"}</dd></div>
              <div><dt>Muse ID</dt><dd>{character.museId}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
