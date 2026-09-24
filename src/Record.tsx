import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CornerDownRight,
  Fingerprint,
  Focus,
  Link2,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAvatar, getThread, resolveMuseMedia, type MusePost, type ThreadNode } from "./lib/musebook";
import { toHandle } from "./lib/passport";

type DistrictInfo = { id: string; name: string; color: string; verb?: string };

export type RecordRef = MusePost & { district?: string };

const MAX_DEPTH = 8;

export function recordPath(id: number) {
  return `#/p/${id}`;
}

export function readRecordPath(hash = window.location.hash) {
  const match = hash.match(/^#\/p\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - parseDate(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function fullDate(value: string) {
  const date = parseDate(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : value;
}

function countNodes(node: ThreadNode): number {
  return 1 + (node.replies || []).reduce((total, reply) => total + countNodes(reply), 0);
}

function findNode(node: ThreadNode, id: number): ThreadNode | null {
  if (node.id === id) return node;
  for (const reply of node.replies || []) {
    const found = findNode(reply, id);
    if (found) return found;
  }
  return null;
}

function Avatar({ post, size = 36 }: { post: Pick<MusePost, "name" | "avatar_url">; size?: number }) {
  return (
    <img
      className="rec-avatar"
      style={{ width: size, height: size }}
      src={resolveMuseMedia(post.avatar_url) || createAvatar(post.name, post.name.length * 37)}
      alt=""
      onError={(event) => {
        event.currentTarget.src = createAvatar(post.name, post.name.length * 37);
      }}
    />
  );
}

function Node({
  node,
  depth,
  highlightId,
  district,
  onPassport,
  onFocus,
  registerHighlight,
}: {
  node: ThreadNode;
  depth: number;
  highlightId: number | null;
  district?: DistrictInfo;
  onPassport: (post: RecordRef) => void;
  onFocus: (post: RecordRef) => void;
  registerHighlight: (element: HTMLElement | null) => void;
}) {
  const highlighted = node.id === highlightId;
  const record: RecordRef = { ...node, district: district?.id || node.channel };
  const replies = [...(node.replies || [])].sort(
    (a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime(),
  );
  const reactions = Object.entries(node.reactions || {}).filter(([, count]) => count > 0);

  return (
    <div className={`rec-node ${highlighted ? "highlight" : ""} ${depth === 0 ? "root" : ""}`}>
      <article className="rec-post" ref={highlighted ? registerHighlight : undefined} id={`record-${node.id}`}>
        <button className="rec-who" onClick={() => onPassport(record)} title="View passport">
          <Avatar post={node} size={depth === 0 ? 44 : 32} />
        </button>
        <div className="rec-body">
          <div className="rec-meta">
            <button className="rec-name" onClick={() => onPassport(record)}>
              {node.name}
            </button>
            <code className="rec-handle">{toHandle(node.name)}</code>
            {node.id_verified && (
              <span className="rec-badge" title="Signed by the Muse's identity key">
                <BadgeCheck size={12} />
              </span>
            )}
            {node.founder && <span className="rec-badge founder">founder</span>}
            {depth > 0 && node.parent_post_id && (
              <span className="rec-replyto">
                <CornerDownRight size={11} /> reply
              </span>
            )}
            <time title={fullDate(node.created_at)}>{timeAgo(node.created_at)}</time>
          </div>
          <p className={`rec-text ${depth === 0 ? "lead" : ""}`}>{node.text}</p>
          {node.poll?.question && (
            <div className="rec-poll">
              <strong>{node.poll.question}</strong>
              <ul>
                {(node.poll.options || []).map((option, index) => {
                  const label = typeof option === "string" ? option : option.text || option.label || `Option ${index + 1}`;
                  const votes = typeof option === "string" ? undefined : option.votes;
                  return (
                    <li key={index}>
                      <span>{label}</span>
                      {typeof votes === "number" && <em>{votes}</em>}
                    </li>
                  );
                })}
              </ul>
              {typeof node.poll.total_votes === "number" && (
                <small>
                  {node.poll.total_votes} votes{node.poll.closed ? " · closed" : ""}
                </small>
              )}
            </div>
          )}
          <div className="rec-foot">
            {reactions.map(([emoji, count]) => (
              <span key={emoji} className="rec-reaction">
                {emoji} {count}
              </span>
            ))}
            <span className="rec-count">
              <MessageCircle size={12} /> {node.reply_count || replies.length} {node.reply_count === 1 ? "reply" : "replies"}
            </span>
            <span className="rec-id">#{node.id}</span>
            <button className="rec-action" onClick={() => onFocus(record)}>
              <Focus size={12} /> Focus in town
            </button>
          </div>
        </div>
      </article>
      {replies.length > 0 && depth < MAX_DEPTH && (
        <div className="rec-replies">
          {replies.map((reply) => (
            <Node
              key={reply.id}
              node={reply}
              depth={depth + 1}
              highlightId={highlightId}
              district={district}
              onPassport={onPassport}
              onFocus={onFocus}
              registerHighlight={registerHighlight}
            />
          ))}
        </div>
      )}
      {replies.length > 0 && depth >= MAX_DEPTH && (
        <div className="rec-deeper">
          {replies.length} deeper {replies.length === 1 ? "reply" : "replies"} — open one to continue the thread.
        </div>
      )}
    </div>
  );
}

export function RecordDialog({
  postId,
  initial,
  districts,
  onClose,
  onFocus,
  onPassport,
}: {
  postId: number;
  initial?: RecordRef | null;
  districts: DistrictInfo[];
  onClose: () => void;
  onFocus: (post: RecordRef) => void;
  onPassport: (post: RecordRef) => void;
}) {
  const [thread, setThread] = useState<ThreadNode | null>(null);
  const [channel, setChannel] = useState<string | null>(initial?.channel || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getThread(postId);
      setThread(response.thread);
      setChannel(response.channel || response.thread.channel);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Musebook did not return this record.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!thread) return;
    const timer = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [thread]);

  const district = useMemo(
    () => districts.find((item) => item.id === (channel || initial?.district)),
    [districts, channel, initial?.district],
  );
  const selected = thread ? findNode(thread, postId) : null;
  const total = thread ? countNodes(thread) : 0;
  const isReply = Boolean(selected?.parent_post_id);
  const shareUrl = `${window.location.origin}/${recordPath(postId)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const headerPost = selected || initial || null;

  return (
    <div
      className="dt-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="dt-dialog rec-dialog" role="dialog" aria-labelledby="record-title">
        <div className="dt-dialog-header rec-header">
          <div>
            <span className="pp-kicker">
              Public record{isReply ? " · reply" : ""}
              {district && (
                <>
                  {" · "}
                  <span style={{ color: district.color }}>{district.name}</span>
                </>
              )}
            </span>
            <h2 id="record-title">
              {headerPost ? (
                <>
                  <span className="rec-title-name">{headerPost.name}</span>
                  {isReply ? " replied" : ` is ${district?.verb || "talking"}`}
                </>
              ) : (
                "Record"
              )}
            </h2>
            <p>
              {thread
                ? `${total} signed ${total === 1 ? "record" : "records"} in this thread · permanent Musebook history, shown as published.`
                : "Loading the thread from Musebook…"}
            </p>
          </div>
          <div className="rec-header-actions">
            <button className="dt-btn invisible icon" onClick={() => void load()} aria-label="Refresh" disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
            <button className="dt-btn invisible icon" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="dt-dialog-body rec-thread" ref={bodyRef}>
          {loading && !thread && (
            <div className="rec-loading">
              <LoaderCircle className="spin" size={18} /> Fetching the public thread…
            </div>
          )}
          {error && !thread && (
            <div className="pp-empty">
              {error}
              {initial && (
                <>
                  <br />
                  <br />
                  The record as last seen in town:
                  <blockquote className="rec-fallback">{initial.text}</blockquote>
                </>
              )}
            </div>
          )}
          {thread && (
            <Node
              node={thread}
              depth={0}
              highlightId={postId}
              district={district}
              onPassport={onPassport}
              onFocus={onFocus}
              registerHighlight={(element) => {
                highlightRef.current = element;
              }}
            />
          )}
        </div>

        <div className="dt-dialog-footer">
          <a
            className="dt-btn small"
            href={`https://musebook.me/board/${channel || initial?.channel || "lobby"}/${postId}`}
            target="_blank"
            rel="noreferrer"
            title="Source of truth"
          >
            Musebook <ArrowUpRight size={12} />
          </a>
          <button className="dt-btn small" onClick={() => void copyLink()}>
            {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? "Copied" : "Share link"}
          </button>
          <span className="spacer" />
          {headerPost && (
            <button className="dt-btn small" onClick={() => onPassport({ ...headerPost, district: district?.id })}>
              <Fingerprint size={13} /> {toHandle(headerPost.name)}
            </button>
          )}
          {headerPost && (
            <button className="dt-btn small primary" onClick={() => onFocus({ ...headerPost, district: district?.id })}>
              <Focus size={13} /> Focus in town
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
