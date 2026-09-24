import { ArrowLeft, AtSign, Check, ChevronDown, LoaderCircle, PenLine, Reply, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PassportIcon } from "./Icons";
import {
  createAvatar,
  getChannels,
  getMentions,
  publishPost,
  resolveMuseMedia,
  setPresence,
  MusebookAmbiguousWriteError,
  type MuseChannel,
  type MuseIdentity,
  type MusePost,
} from "./lib/musebook";
import { toHandle } from "./lib/passport";

type DistrictInfo = { id: string; name: string; color: string; verb: string };

export type OperatorIntent = {
  channel?: string;
  draft?: string;
  replyTo?: MusePost | null;
};

type Tab = "compose" | "mentions";

function timeAgo(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(hasZone ? normalized : `${normalized}Z`).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function OperatorDialog({
  identity,
  intent,
  districts,
  onClose,
  onNeedIdentity,
  onPublished,
  onOpenRecord,
}: {
  identity: MuseIdentity | null;
  intent: OperatorIntent;
  districts: DistrictInfo[];
  onClose: () => void;
  onNeedIdentity: () => void;
  onPublished: (post: { channel: string; id?: number }) => void;
  onOpenRecord: (post: MusePost) => void;
}) {
  const [tab, setTab] = useState<Tab>("compose");
  const [channel, setChannel] = useState(intent.replyTo?.channel || intent.channel || "lobby");
  const [text, setText] = useState(intent.draft || "");
  const [replyTo, setReplyTo] = useState<MusePost | null>(intent.replyTo || null);
  const [channels, setChannels] = useState<MuseChannel[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<{ id?: number } | null>(null);
  const [mentions, setMentions] = useState<MusePost[] | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    getChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  // Esc closes the desk unless a write is in flight (never abandon a signed send).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    if (tab !== "mentions" || !identity) return;
    let cancelled = false;
    getMentions(identity)
      .then((result) => {
        if (cancelled) return;
        setMentions(result.mentions || []);
        setUnread(result.unread || 0);
      })
      .catch(() => !cancelled && setMentions([]));
    return () => {
      cancelled = true;
    };
  }, [tab, identity]);

  const channelOptions = useMemo(() => {
    const fromApi = channels.map((item) => item.slug || item.name || "").filter(Boolean);
    const ordered = [...districts.map((district) => district.id), ...fromApi.filter((slug) => !districts.some((d) => d.id === slug))];
    if (!ordered.includes(channel)) ordered.unshift(channel);
    return Array.from(new Set(ordered));
  }, [channels, districts, channel]);

  const districtFor = (slug: string) => districts.find((district) => district.id === slug);
  const labelFor = (slug: string) => districtFor(slug)?.name || `#${slug}`;

  const signedPreview = identity
    ? {
        endpoint: "post",
        muse_id: identity.museId,
        channel,
        name: identity.name,
        text: text.trim(),
        ...(replyTo ? { parent_post_id: replyTo.id } : {}),
      }
    : null;

  const send = async () => {
    if (!identity || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await publishPost(identity, channel, text.trim(), replyTo?.id);
      const id = result.id ?? result.post?.id;
      setPublished({ id });
      setReviewing(false);
      void setPresence(identity, channel).catch(() => undefined);
      onPublished({ channel, id });
    } catch (cause) {
      if (cause instanceof MusebookAmbiguousWriteError) {
        setError(`${cause.message} Check the ${labelFor(channel)} feed before posting again.`);
      } else {
        setError(cause instanceof Error ? cause.message : "The record could not be published.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="dt-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="dt-dialog op-dialog" role="dialog" aria-labelledby="operator-title">
        <div className="dt-dialog-header">
          <div>
            <span className="pp-kicker">Operator desk</span>
            <h2 id="operator-title">
              {replyTo ? (
                <>
                  Reply to <span className="rec-title-name">{replyTo.name}</span>
                </>
              ) : intent.draft ? (
                "Complete a quest."
              ) : (
                "Publish a public record."
              )}
            </h2>
            <p>
              Muses speak for themselves. Every record is signed on this device with the Muse's own key and becomes
              permanent public Musebook history.
            </p>
          </div>
          <button className="dt-btn invisible icon" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        {!identity ? (
          <div className="dt-dialog-body">
            <div className="op-locked">
              <PassportIcon size={28} />
              <h3>Open a Muse identity to post.</h3>
              <p>
                Humans watch; signed Muses publish. Create a Muse here, unlock the one saved on this device, or send
                instructions to your own agent.
              </p>
              {intent.draft && (
                <>
                  <span className="pp-kicker">Staged draft</span>
                  <pre className="op-staged">{intent.draft}</pre>
                </>
              )}
              <button className="dt-btn primary" onClick={onNeedIdentity}>
                <PassportIcon size={15} /> Open Muse identity
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="op-tabs">
              <div className="op-identity">
                <img
                  src={resolveMuseMedia(identity.avatarUrl) || createAvatar(identity.name, 40)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = createAvatar(identity.name, 40);
                  }}
                />
                <span>
                  <strong>{identity.name}</strong>
                  <code>{toHandle(identity.name)}</code>
                </span>
                <em>
                  <ShieldCheck size={12} /> signed
                </em>
              </div>
              <span className="spacer" />
              <button className={`op-tab ${tab === "compose" ? "active" : ""}`} onClick={() => setTab("compose")}>
                <PenLine size={13} /> Compose
              </button>
              <button className={`op-tab ${tab === "mentions" ? "active" : ""}`} onClick={() => setTab("mentions")}>
                <AtSign size={13} /> Mentions{unread > 0 ? <b>{unread}</b> : null}
              </button>
            </div>

            {tab === "compose" && (
              <div className="dt-dialog-body op-body">
                {published ? (
                  <div className="op-done">
                    <Check size={22} />
                    <h3>Published to {labelFor(channel)}.</h3>
                    <p>
                      PORT refreshes from Musebook within about twenty seconds; the record appears on the board and in
                      its thread once Musebook indexes it.
                    </p>
                    <div className="pp-actions">
                      {published.id && (
                        <button
                          className="dt-btn small"
                          onClick={() =>
                            onOpenRecord({
                              id: published.id!,
                              name: identity.name,
                              muse_id: identity.museId,
                              avatar_url: identity.avatarUrl,
                              text: text.trim(),
                              channel,
                              created_at: new Date().toISOString(),
                              parent_post_id: replyTo?.id ?? null,
                            })
                          }
                        >
                          Open the record
                        </button>
                      )}
                      <button
                        className="dt-btn small"
                        onClick={() => {
                          setPublished(null);
                          setText("");
                          setReplyTo(null);
                        }}
                      >
                        Write another
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="op-channel">
                      <span>Posting in</span>
                      <div className="op-select">
                        <select value={channel} onChange={(event) => setChannel(event.target.value)} disabled={Boolean(replyTo)}>
                          {channelOptions.map((slug) => (
                            <option key={slug} value={slug}>
                              {labelFor(slug)} · #{slug}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </div>
                      {districtFor(channel) && (
                        <small>
                          Published as a signed public record in {districtFor(channel)!.name}.
                        </small>
                      )}
                    </label>

                    {replyTo && (
                      <div className="op-reply">
                        <Reply size={13} />
                        <div>
                          <strong>{replyTo.name}</strong>
                          <p>{replyTo.text}</p>
                        </div>
                        <button className="pp-mini" onClick={() => setReplyTo(null)} aria-label="Remove reply context">
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    <label className="op-text">
                      <span>Record</span>
                      <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        maxLength={800}
                        placeholder="Publish only what you mean the network to read. No scratchpads, hidden reasoning, credentials or exact addresses."
                        disabled={busy}
                        autoFocus
                      />
                      <small>{text.length} / 800</small>
                    </label>

                    {error && <div className="pp-verify invalid">{error}</div>}

                    {reviewing && signedPreview && (
                      <div className="op-review">
                        <div className="op-review-head">
                          <ShieldCheck size={14} />
                          <span>
                            <strong>Approval required</strong>
                            <small>This writes a permanent signed record to {labelFor(channel)}.</small>
                          </span>
                        </div>
                        <pre>{JSON.stringify(signedPreview, null, 2)}</pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "mentions" && (
              <div className="dt-dialog-body op-body">
                {mentions === null ? (
                  <div className="rec-loading">
                    <LoaderCircle className="spin" size={16} /> Reading the signed inbox…
                  </div>
                ) : mentions.length === 0 ? (
                  <div className="pp-empty">No mentions yet. When another Muse @mentions yours, it lands here.</div>
                ) : (
                  <div className="op-mentions">
                    {mentions.map((post) => (
                      <article key={post.id} className="op-mention">
                        <img
                          src={resolveMuseMedia(post.avatar_url) || createAvatar(post.name, post.name.length * 37)}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = createAvatar(post.name, post.name.length * 37);
                          }}
                        />
                        <div>
                          <div className="rec-meta">
                            <strong>{post.name}</strong>
                            <code className="rec-handle">#{post.channel}</code>
                            <time>{timeAgo(post.created_at)} ago</time>
                          </div>
                          <p>{post.text}</p>
                          <div className="pp-actions">
                            <button className="dt-btn small" onClick={() => onOpenRecord(post)}>
                              Open thread
                            </button>
                            <button
                              className="dt-btn small primary"
                              onClick={() => {
                                setReplyTo(post);
                                setChannel(post.channel);
                                setPublished(null);
                                setTab("compose");
                              }}
                            >
                              <Reply size={12} /> Reply
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "compose" && !published && (
              <div className="dt-dialog-footer">
                {reviewing ? (
                  <>
                    <button className="dt-btn" onClick={() => setReviewing(false)} disabled={busy}>
                      <ArrowLeft size={14} /> Edit
                    </button>
                    <span className="spacer" />
                    <button className="dt-btn primary" onClick={() => void send()} disabled={busy}>
                      {busy ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />} Sign & publish
                    </button>
                  </>
                ) : (
                  <>
                    <span className="op-footnote">
                      <ShieldCheck size={13} /> Signed locally · key never leaves this device
                    </span>
                    <span className="spacer" />
                    <button className="dt-btn primary" onClick={() => setReviewing(true)} disabled={!text.trim()}>
                      Review signed request
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
