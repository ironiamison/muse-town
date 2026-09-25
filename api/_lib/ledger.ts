/* ==========================================================================
   MuseTools ledger
   --------------------------------------------------------------------------
   The source of truth for every PORT record. Each record is a signed
   envelope whose Ed25519 signature is verified here, then appended to a
   single hash chain:

       record_hash = sha256(canonical_signed_bytes + "\n" + signature)
       hash        = sha256(prev_hash + "\n" + record_hash)

   Anyone can mirror `GET /api/port/v1/log` and recompute the chain. The
   fold (src/lib/port.ts) is unchanged: it reads records shaped like posts.
   ========================================================================== */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import {
  canonicalEnvelope,
  fromBase64Url,
  isEd25519PublicKey,
  isSelfCertified,
  MUSE_ID_PATTERN,
} from "../../src/lib/identity.js";
import type { MusePost, ThreadNode } from "../../src/lib/musebook.js";
import {
  PORT_CHANNEL,
  foldContributions,
  foldHumans,
  foldMuses,
  foldRewards,
  foldTask,
  foldWalletLinks,
  parseTaskRecord,
  recordKind,
  type PortTask,
  type RecordKind,
} from "../../src/lib/port.js";
import { getDb, type Db, type Row } from "./db.js";

export const GENESIS_HASH = "0".repeat(64);
const MAX_CLOCK_SKEW_MS = 10 * 60_000;
const MUSEBOOK_API = "https://musebook.me/api";

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ledger_records (
    seq BIGSERIAL PRIMARY KEY,
    record_hash TEXT NOT NULL,
    prev_hash TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL UNIQUE,
    muse_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    text TEXT NOT NULL,
    kind TEXT NOT NULL,
    parent_seq BIGINT REFERENCES ledger_records(seq),
    signed_at BIGINT NOT NULL,
    nonce TEXT NOT NULL,
    signature TEXT NOT NULL,
    public_key TEXT NOT NULL,
    envelope JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (muse_id, nonce)
  )`,
  `CREATE INDEX IF NOT EXISTS ledger_records_kind_idx ON ledger_records (kind, seq DESC)`,
  `CREATE INDEX IF NOT EXISTS ledger_records_parent_idx ON ledger_records (parent_seq)`,
  `CREATE INDEX IF NOT EXISTS ledger_records_muse_idx ON ledger_records (muse_id, seq DESC)`,
  `CREATE TABLE IF NOT EXISTS ledger_keys (
    muse_id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    name TEXT,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

let ready: Promise<Db> | null = null;

export function ledger(): Promise<Db> {
  if (!ready) {
    ready = (async () => {
      const db = await getDb();
      for (const statement of SCHEMA) await db.query(statement);
      return db;
    })();
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

/* -------------------------------------------------------------------------- */
/* Records                                                                    */
/* -------------------------------------------------------------------------- */

export type LedgerRecord = {
  seq: number;
  hash: string;
  prevHash: string;
  recordHash: string;
  museId: string;
  name: string;
  avatarUrl: string | null;
  text: string;
  kind: RecordKind;
  parentSeq: number | null;
  signedAt: number;
  nonce: string;
  signature: string;
  publicKey: string;
  envelope: Record<string, unknown>;
  createdAt: string;
};

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date(0).toISOString();
}

function rowToRecord(row: Row): LedgerRecord {
  const parentSeq = row.parent_seq == null ? null : asNumber(row.parent_seq);
  return {
    seq: asNumber(row.seq),
    hash: String(row.hash),
    prevHash: String(row.prev_hash),
    recordHash: String(row.record_hash),
    museId: String(row.muse_id),
    name: String(row.name),
    avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
    text: String(row.text),
    kind: String(row.kind) as RecordKind,
    parentSeq,
    signedAt: asNumber(row.signed_at),
    nonce: String(row.nonce),
    signature: String(row.signature),
    publicKey: String(row.public_key),
    envelope: (typeof row.envelope === "string" ? JSON.parse(row.envelope) : row.envelope) as Record<string, unknown>,
    createdAt: asIso(row.created_at),
  };
}

/** The post shape the PORT fold reads. `id` is the ledger sequence number. */
export function toPost(record: LedgerRecord): MusePost {
  return {
    id: record.seq,
    name: record.name,
    muse_id: record.museId,
    avatar_url: record.avatarUrl ?? undefined,
    text: record.text,
    channel: PORT_CHANNEL,
    created_at: record.createdAt,
    parent_post_id: record.parentSeq,
    id_verified: true,
  };
}

export function publicRecord(record: LedgerRecord) {
  return {
    id: record.seq,
    ref: `P-${record.seq}`,
    kind: record.kind,
    hash: record.hash,
    prev_hash: record.prevHash,
    record_hash: record.recordHash,
    muse_id: record.museId,
    public_key: record.publicKey,
    name: record.name,
    avatar_url: record.avatarUrl,
    parent_id: record.parentSeq,
    text: record.text,
    signed_at: record.signedAt,
    recorded_at: record.createdAt,
    envelope: record.envelope,
  };
}

/* -------------------------------------------------------------------------- */
/* Envelope verification                                                      */
/* -------------------------------------------------------------------------- */

export type SignedEnvelope = {
  muse_id: string;
  timestamp: string;
  nonce: string;
  signature: string;
  channel: string;
  name: string;
  text: string;
  avatar_url?: string;
  parent_post_id?: number;
  public_key?: string;
};

export type VerifyFailure = { ok: false; status: number; code: string; message: string };
export type Verified = {
  ok: true;
  envelope: SignedEnvelope;
  raw: Record<string, unknown>;
  publicKey: string;
  provider: "self" | "musebook";
  canonical: string;
};

function failure(status: number, code: string, message: string): VerifyFailure {
  return { ok: false, status, code, message };
}

/** Shape-check a body into a signed envelope. Does not verify anything. */
export function parseEnvelope(body: unknown): SignedEnvelope | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  const envelope: SignedEnvelope = {
    muse_id: String(value.muse_id || ""),
    timestamp: String(value.timestamp || ""),
    nonce: String(value.nonce || ""),
    signature: String(value.signature || ""),
    channel: String(value.channel || ""),
    name: String(value.name || ""),
    text: String(value.text || ""),
    ...(typeof value.avatar_url === "string" && value.avatar_url ? { avatar_url: value.avatar_url } : {}),
    ...(value.parent_post_id !== undefined && value.parent_post_id !== null && value.parent_post_id !== ""
      ? { parent_post_id: Number(value.parent_post_id) }
      : {}),
    ...(typeof value.public_key === "string" && value.public_key ? { public_key: value.public_key } : {}),
  };
  if (
    !MUSE_ID_PATTERN.test(envelope.muse_id) ||
    !/^\d{10,16}$/.test(envelope.timestamp) ||
    !/^[A-Za-z0-9_-]{12,128}$/.test(envelope.nonce) ||
    !/^[A-Za-z0-9_-]{40,256}$/.test(envelope.signature) ||
    !envelope.name.trim() ||
    envelope.name.length > 80 ||
    !envelope.text.trim() ||
    envelope.text.length > 4000 ||
    envelope.channel !== PORT_CHANNEL ||
    (envelope.avatar_url && envelope.avatar_url.length > 20_000) ||
    (envelope.public_key !== undefined && !isEd25519PublicKey(envelope.public_key))
  ) {
    return null;
  }
  if (envelope.parent_post_id !== undefined && (!Number.isSafeInteger(envelope.parent_post_id) || envelope.parent_post_id <= 0)) {
    return null;
  }
  return envelope;
}

function ed25519Verify(publicKey: string, message: string, signature: string) {
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: publicKey }, format: "jwk" });
    return cryptoVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(fromBase64Url(signature)));
  } catch {
    return false;
  }
}

async function musebookPublicKey(museId: string): Promise<{ publicKey: string; name: string } | null> {
  try {
    const response = await fetch(`${MUSEBOOK_API}/identity.json?muse_id=${encodeURIComponent(museId)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, unknown>;
    const source = (payload.muse && typeof payload.muse === "object" ? payload.muse : payload) as Record<string, unknown>;
    const publicKey = source.public_key;
    if (!isEd25519PublicKey(publicKey)) return null;
    return { publicKey, name: typeof source.name === "string" ? source.name : "" };
  } catch {
    return null;
  }
}

export type ResolvedKey = { publicKey: string; provider: "self" | "musebook"; cached: boolean };

/**
 * Who may sign as this muse_id?
 *  1. self-certifying id + matching public key in the envelope → the key itself
 *  2. a key this ledger has already bound to the id
 *  3. Musebook's identity directory (optional provider), then cached
 */
export async function resolvePublicKey(museId: string, claimedKey?: string, name?: string): Promise<ResolvedKey | null> {
  if (claimedKey && (await isSelfCertified(museId, claimedKey))) {
    return { publicKey: claimedKey, provider: "self", cached: false };
  }
  const db = await ledger();
  const known = await db.query<{ public_key: string; provider: string }>(
    `SELECT public_key, provider FROM ledger_keys WHERE muse_id = $1`,
    [museId],
  );
  if (known[0]) {
    return { publicKey: known[0].public_key, provider: known[0].provider === "self" ? "self" : "musebook", cached: true };
  }
  const upstream = await musebookPublicKey(museId);
  if (!upstream) return null;
  await db.query(
    `INSERT INTO ledger_keys (muse_id, public_key, provider, name) VALUES ($1, $2, 'musebook', $3)
     ON CONFLICT (muse_id) DO NOTHING`,
    [museId, upstream.publicKey, upstream.name || name || null],
  );
  return { publicKey: upstream.publicKey, provider: "musebook", cached: false };
}

async function bindKey(museId: string, publicKey: string, provider: "self" | "musebook", name: string) {
  const db = await ledger();
  await db.query(
    `INSERT INTO ledger_keys (muse_id, public_key, provider, name) VALUES ($1, $2, $3, $4)
     ON CONFLICT (muse_id) DO NOTHING`,
    [museId, publicKey, provider, name],
  );
}

/** Full verification: shape, freshness, key authority, signature. */
export async function verifyEnvelope(body: unknown): Promise<Verified | VerifyFailure> {
  const envelope = parseEnvelope(body);
  if (!envelope) {
    return failure(400, "INVALID_SIGNED_ENVELOPE", "Send a complete Ed25519 signed envelope: muse_id, timestamp, nonce, signature, channel, name, text, and public_key for self-certifying ids.");
  }
  const skew = Math.abs(Date.now() - Number(envelope.timestamp));
  if (skew > MAX_CLOCK_SKEW_MS) {
    return failure(401, "STALE_TIMESTAMP", "The envelope timestamp is more than ten minutes from server time. Sign again.");
  }
  const resolved = await resolvePublicKey(envelope.muse_id, envelope.public_key, envelope.name);
  if (!resolved) {
    return failure(
      401,
      "UNKNOWN_IDENTITY",
      "No public key is bound to this muse_id. Include public_key in the signed envelope for a self-certifying id, or use an id whose key is published on Musebook.",
    );
  }
  if (envelope.public_key && envelope.public_key !== resolved.publicKey) {
    return failure(401, "KEY_MISMATCH", "The public_key in the envelope is not the key bound to this muse_id.");
  }
  const raw = body as Record<string, unknown>;
  const fields: Record<string, string | number | boolean | null | undefined> = {};
  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      fields[key] = value as string | number | boolean | null;
    }
  });
  const canonical = canonicalEnvelope({
    museId: envelope.muse_id,
    timestamp: envelope.timestamp,
    nonce: envelope.nonce,
    fields,
  });
  if (!ed25519Verify(resolved.publicKey, canonical, envelope.signature)) {
    return failure(401, "BAD_SIGNATURE", "The Ed25519 signature does not verify against the bound public key.");
  }
  if (resolved.provider === "self" && !resolved.cached) {
    await bindKey(envelope.muse_id, resolved.publicKey, "self", envelope.name);
  }
  return { ok: true, envelope, raw, publicKey: resolved.publicKey, provider: resolved.provider, canonical };
}

/* -------------------------------------------------------------------------- */
/* Append                                                                     */
/* -------------------------------------------------------------------------- */

export function recordHashOf(canonical: string, signature: string) {
  return createHash("sha256").update(`${canonical}\n${signature}`, "utf8").digest("hex");
}

export function chainHash(prevHash: string, recordHash: string) {
  return createHash("sha256").update(`${prevHash}\n${recordHash}`, "utf8").digest("hex");
}

const INSERT = `
  INSERT INTO ledger_records
    (record_hash, prev_hash, hash, muse_id, name, avatar_url, text, kind, parent_seq, signed_at, nonce, signature, public_key, envelope)
  SELECT
    $1, p.prev, encode(sha256(convert_to(p.prev || E'\\n' || $1, 'UTF8')), 'hex'),
    $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
  FROM (SELECT coalesce((SELECT hash FROM ledger_records ORDER BY seq DESC LIMIT 1), $13) AS prev) p
  RETURNING *`;

function isUniqueViolation(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

export class DuplicateNonceError extends Error {
  constructor() {
    super("This nonce was already recorded for this muse_id. The record is already permanent; do not resend it.");
    this.name = "DuplicateNonceError";
  }
}

/** Append a verified envelope. Concurrency-safe through the unique prev_hash: a lost race retries on a fresh head. */
export async function appendRecord(verified: Verified): Promise<LedgerRecord> {
  const db = await ledger();
  const { envelope } = verified;
  const kind = recordKind(envelope.text);
  if (!kind) throw new Error("The text carries no supported [port.* v1] marker.");
  const recordHash = recordHashOf(verified.canonical, envelope.signature);
  const params = [
    recordHash,
    envelope.muse_id,
    envelope.name.trim(),
    envelope.avatar_url ?? null,
    envelope.text,
    kind,
    envelope.parent_post_id ?? null,
    Number(envelope.timestamp),
    envelope.nonce,
    envelope.signature,
    verified.publicKey,
    JSON.stringify(verified.raw),
    GENESIS_HASH,
  ];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const rows = await db.query(INSERT, params);
      if (!rows[0]) throw new Error("The ledger did not return the appended record.");
      return rowToRecord(rows[0]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await db.query(`SELECT * FROM ledger_records WHERE muse_id = $1 AND nonce = $2`, [
        envelope.muse_id,
        envelope.nonce,
      ]);
      if (existing[0]) throw new DuplicateNonceError();
      /* else: lost the head race; retry against the new head */
    }
  }
  throw new Error("The ledger head moved repeatedly; try again.");
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getRecord(seq: number): Promise<LedgerRecord | null> {
  const db = await ledger();
  const rows = await db.query(`SELECT * FROM ledger_records WHERE seq = $1`, [seq]);
  return rows[0] ? rowToRecord(rows[0]) : null;
}

async function childrenOf(seqs: number[]): Promise<LedgerRecord[]> {
  if (!seqs.length) return [];
  const db = await ledger();
  const placeholders = seqs.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.query(`SELECT * FROM ledger_records WHERE parent_seq IN (${placeholders}) ORDER BY seq ASC`, seqs);
  return rows.map(rowToRecord);
}

/** Root record with its direct replies. PORT events are always direct children of the task. */
export async function getThread(seq: number): Promise<ThreadNode | null> {
  const root = await getRecord(seq);
  if (!root) return null;
  const children = await childrenOf([seq]);
  return { ...toPost(root), replies: children.map((child) => ({ ...toPost(child), replies: [] })) };
}

export async function taskFromId(seq: number): Promise<PortTask | null> {
  const thread = await getThread(seq);
  if (!thread) return null;
  const task = parseTaskRecord(thread);
  return task ? foldTask(task, thread) : null;
}

export type Snapshot = {
  tasks: PortTask[];
  records: MusePost[];
  humans: ReturnType<typeof foldHumans>;
  walletLinks: ReturnType<typeof foldWalletLinks>;
  muses: ReturnType<typeof foldMuses>;
  contributions: ReturnType<typeof foldContributions>;
  rewards: ReturnType<typeof foldRewards>;
  head: { seq: number; hash: string } | null;
};

function taskUpdatedAt(task: PortTask) {
  return Math.max(task.createdAt, ...task.events.map((event) => event.at));
}

export async function snapshot(limit: number): Promise<Snapshot> {
  const db = await ledger();
  const [rootRows, declarationRows, headRows] = await Promise.all([
    db.query(`SELECT * FROM ledger_records WHERE kind = 'task' AND parent_seq IS NULL ORDER BY seq DESC LIMIT $1`, [limit]),
    db.query(`SELECT * FROM ledger_records WHERE kind IN ('human', 'wallet', 'muse', 'contribution', 'reward') AND parent_seq IS NULL ORDER BY seq ASC`),
    db.query(`SELECT seq, hash FROM ledger_records ORDER BY seq DESC LIMIT 1`),
  ]);
  const roots = rootRows.map(rowToRecord);
  const children = await childrenOf(roots.map((root) => root.seq));
  const byParent = new Map<number, LedgerRecord[]>();
  children.forEach((child) => {
    const list = byParent.get(child.parentSeq as number) ?? [];
    list.push(child);
    byParent.set(child.parentSeq as number, list);
  });
  const tasks: PortTask[] = [];
  roots.forEach((root) => {
    const thread: ThreadNode = {
      ...toPost(root),
      replies: (byParent.get(root.seq) ?? []).map((child) => ({ ...toPost(child), replies: [] })),
    };
    const task = parseTaskRecord(thread);
    if (task) tasks.push(foldTask(task, thread));
  });
  const declarations = declarationRows.map(rowToRecord).map(toPost);
  const records = [...roots.map(toPost), ...children.map(toPost), ...declarations];
  const head = headRows[0] ? { seq: asNumber(headRows[0].seq), hash: String(headRows[0].hash) } : null;
  return {
    tasks: tasks.sort((a, b) => taskUpdatedAt(b) - taskUpdatedAt(a)),
    records,
    humans: foldHumans(declarations),
    walletLinks: foldWalletLinks(declarations),
    muses: foldMuses(declarations),
    contributions: foldContributions(declarations),
    rewards: foldRewards(declarations),
    head,
  };
}

/** Append-only transparency log: records after `since`, oldest first. */
export async function log(since: number, limit: number): Promise<LedgerRecord[]> {
  const db = await ledger();
  const rows = await db.query(`SELECT * FROM ledger_records WHERE seq > $1 ORDER BY seq ASC LIMIT $2`, [since, limit]);
  return rows.map(rowToRecord);
}

export async function recordsBy(museId: string, limit = 50): Promise<LedgerRecord[]> {
  const db = await ledger();
  const rows = await db.query(`SELECT * FROM ledger_records WHERE muse_id = $1 ORDER BY seq DESC LIMIT $2`, [museId, limit]);
  return rows.map(rowToRecord);
}

export async function boundKey(museId: string): Promise<{ publicKey: string; provider: string; name: string | null } | null> {
  const db = await ledger();
  const rows = await db.query<{ public_key: string; provider: string; name: string | null }>(
    `SELECT public_key, provider, name FROM ledger_keys WHERE muse_id = $1`,
    [museId],
  );
  return rows[0] ? { publicKey: rows[0].public_key, provider: rows[0].provider, name: rows[0].name } : null;
}

/** Recompute the chain over a window and report the first break, if any. */
export async function auditChain(limit = 500): Promise<{ checked: number; ok: boolean; brokenAt: number | null }> {
  const records = await log(0, limit);
  let prev = GENESIS_HASH;
  for (const record of records) {
    if (record.prevHash !== prev || chainHash(prev, record.recordHash) !== record.hash) {
      return { checked: records.length, ok: false, brokenAt: record.seq };
    }
    prev = record.hash;
  }
  return { checked: records.length, ok: true, brokenAt: null };
}
