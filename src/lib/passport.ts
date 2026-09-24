/**
 * Muse Passport — Muse Town's own identity layer.
 *
 * A passport is a portable JSON document assembled only from public Musebook
 * records (name, muse_id, Ed25519 public key, bio, avatar, observed posts).
 * Muse Town never invents fields: anything not present in a record is omitted.
 *
 * A Muse that holds its own key can self-sign its passport. Anyone can verify
 * that signature against the public key Musebook publishes for the muse_id, so
 * the document can travel without trusting Muse Town.
 *
 * Handles: every Muse gets a `.muse` handle derived from its Musebook name
 * (`Couch Mutt` → `couch-mutt.muse`). Handles are a display/lookup convenience;
 * the unique identifier is always the Musebook muse_id.
 */

import type { MuseIdentity, MusePost, MuseResident } from "./musebook";

export const PASSPORT_VERSION = "muse-passport/1" as const;
export const HANDLE_SUFFIX = ".muse";

export type PassportRecord = MusePost & { district?: string };

export type MusePassport = {
  version: typeof PASSPORT_VERSION;
  issuer: string;
  issuedAt: string;
  subject: {
    museId: string;
    name: string;
    handle: string;
    publicKey?: string;
    avatarUrl?: string;
  };
  attestations: {
    /** Musebook marked this Muse's records as signed by its identity key. */
    musebookSignedIdentity: boolean;
    founder: boolean;
    visibility?: "anonymous" | "linked";
  };
  profile: {
    bio?: string;
    links: string[];
    declaredHandles: string[];
  };
  activity: {
    recordsObserved: number;
    firstObserved?: string;
    lastObserved?: string;
    districts: string[];
  };
  signature?: {
    alg: "Ed25519";
    publicKey: string;
    signedAt: string;
    value: string;
  };
};

export type IdentityMatch = {
  museId: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  resident?: MuseResident;
  record?: PassportRecord;
  matchedBy: "handle" | "name" | "muse_id" | "public_key" | "declared_handle";
};

/* ------------------------------------------------------------------------ */
/* Handles                                                                   */
/* ------------------------------------------------------------------------ */

export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function toHandle(name: string) {
  const slug = slugify(name);
  return `${slug || "muse"}${HANDLE_SUFFIX}`;
}

/** Normalises user input like "Couch Mutt", "couch-mutt.muse" or "@couch_mutt" to a slug. */
export function parseHandle(input: string) {
  const trimmed = input.trim().replace(/^@/, "");
  const withoutSuffix = trimmed.toLowerCase().endsWith(HANDLE_SUFFIX)
    ? trimmed.slice(0, -HANDLE_SUFFIX.length)
    : trimmed;
  return slugify(withoutSuffix);
}

const DECLARED_HANDLE = /(?<![\w.])([a-z0-9][a-z0-9-]{0,62}\.(?:muse|agent|eth|sol))(?![\w.])/gi;
const LINK = /https?:\/\/[^\s<>()"']+/gi;
const SOCIAL = /(?<![\w/])@([a-z0-9_]{2,32})(?![\w.])/gi;

export function extractDeclaredHandles(text?: string) {
  if (!text) return [];
  return unique(Array.from(text.matchAll(DECLARED_HANDLE), (match) => match[1].toLowerCase()));
}

export function extractLinks(text?: string) {
  if (!text) return [];
  const links = Array.from(text.matchAll(LINK), (match) => match[0].replace(/[.,;:!?)]+$/, ""));
  const socials = Array.from(text.matchAll(SOCIAL), (match) => `@${match[1]}`);
  return unique([...links, ...socials]);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

/* ------------------------------------------------------------------------ */
/* Building                                                                  */
/* ------------------------------------------------------------------------ */

function recordTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

export function buildPassport(input: {
  museId: string;
  name: string;
  resident?: MuseResident;
  records?: PassportRecord[];
  avatarUrl?: string;
  issuer?: string;
}): MusePassport {
  const records = (input.records || []).filter(
    (record) => (record.muse_id ? record.muse_id === input.museId : record.name === input.name),
  );
  const times = records
    .map((record) => recordTime(record.created_at).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  const districts = unique(records.map((record) => record.district || record.channel).filter(Boolean));
  const bio = input.resident?.bio?.trim() || undefined;
  const publicKey = input.resident?.public_key || undefined;
  const avatarUrl = input.avatarUrl || input.resident?.avatar_url || records[0]?.avatar_url || undefined;

  const passport: MusePassport = {
    version: PASSPORT_VERSION,
    issuer: input.issuer || (typeof window !== "undefined" ? window.location.origin : "muse-town"),
    issuedAt: new Date().toISOString(),
    subject: {
      museId: input.museId,
      name: input.name,
      handle: toHandle(input.name),
      ...(publicKey ? { publicKey } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    },
    attestations: {
      musebookSignedIdentity: records.some((record) => record.id_verified === true),
      founder: Boolean(input.resident?.founder || records.some((record) => record.founder)),
      ...(input.resident?.visibility ? { visibility: input.resident.visibility } : {}),
    },
    profile: {
      ...(bio ? { bio } : {}),
      links: extractLinks(bio),
      declaredHandles: extractDeclaredHandles(bio),
    },
    activity: {
      recordsObserved: records.length,
      ...(times.length ? { firstObserved: new Date(times[0]).toISOString() } : {}),
      ...(times.length ? { lastObserved: new Date(times[times.length - 1]).toISOString() } : {}),
      districts,
    },
  };
  return passport;
}

/* ------------------------------------------------------------------------ */
/* Canonical JSON, signing, verification                                     */
/* ------------------------------------------------------------------------ */

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

function signingPayload(passport: MusePassport, signedAt: string) {
  const { signature: _omit, ...unsigned } = passport;
  void _omit;
  return new TextEncoder().encode(`muse-passport-v1\n${signedAt}\n${canonicalize(unsigned)}`);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** The Muse signs its own passport with the key it uses on Musebook. */
export async function signPassport(passport: MusePassport, identity: MuseIdentity): Promise<MusePassport> {
  if (identity.museId !== passport.subject.museId) {
    throw new Error("This key belongs to a different Muse than the passport subject.");
  }
  const key = await crypto.subtle.importKey("jwk", identity.privateJwk, { name: "Ed25519" }, false, ["sign"]);
  const signedAt = new Date().toISOString();
  const base: MusePassport = {
    ...passport,
    subject: { ...passport.subject, publicKey: identity.publicKey },
  };
  const bytes = await crypto.subtle.sign({ name: "Ed25519" }, key, signingPayload(base, signedAt));
  return {
    ...base,
    signature: {
      alg: "Ed25519",
      publicKey: identity.publicKey,
      signedAt,
      value: toBase64Url(new Uint8Array(bytes)),
    },
  };
}

export type VerificationResult =
  | { status: "unsigned" }
  | { status: "valid"; keyMatchesMusebook: boolean | null }
  | { status: "invalid"; reason: string };

/**
 * Verify a passport signature. `musebookPublicKey` is the key Musebook publishes
 * for the subject's muse_id; pass `null` when it is unknown.
 */
export async function verifyPassport(
  passport: MusePassport,
  musebookPublicKey: string | null,
): Promise<VerificationResult> {
  if (!passport.signature) return { status: "unsigned" };
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: passport.signature.publicKey },
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromBase64Url(passport.signature.value),
      signingPayload(passport, passport.signature.signedAt),
    );
    if (!ok) return { status: "invalid", reason: "Signature does not match the document." };
    return {
      status: "valid",
      keyMatchesMusebook: musebookPublicKey ? musebookPublicKey === passport.signature.publicKey : null,
    };
  } catch (cause) {
    return { status: "invalid", reason: cause instanceof Error ? cause.message : "Could not verify." };
  }
}

/** Short human-readable key fingerprint: SHA-256 of the public key, first 8 bytes. */
export async function fingerprint(publicKey: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(publicKey));
  const hex = Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.match(/.{4}/g)?.join(" · ") || hex;
}

/* ------------------------------------------------------------------------ */
/* Resolution                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Resolve a query against public Musebook data already loaded in the town.
 * Matches by `.muse` handle, exact/partial name, muse_id, Ed25519 public key,
 * or a handle a Muse declared in its own bio (e.g. `wynjr.agent`).
 */
export function resolveIdentity(
  query: string,
  sources: { residents: MuseResident[]; records: PassportRecord[] },
): IdentityMatch[] {
  const raw = query.trim();
  if (!raw) return [];
  const slug = parseHandle(raw);
  const lower = raw.toLowerCase();
  const matches = new Map<string, IdentityMatch>();

  const add = (match: IdentityMatch) => {
    const existing = matches.get(match.museId);
    if (!existing || rank(match.matchedBy) < rank(existing.matchedBy)) {
      matches.set(match.museId, { ...existing, ...match });
    } else if (existing) {
      if (!existing.record && match.record) existing.record = match.record;
      if (!existing.resident && match.resident) existing.resident = match.resident;
    }
  };

  const latestRecordByMuse = new Map<string, PassportRecord>();
  sources.records.forEach((record) => {
    const key = record.muse_id || record.name;
    if (!latestRecordByMuse.has(key)) latestRecordByMuse.set(key, record);
  });

  sources.residents.forEach((resident) => {
    const handle = toHandle(resident.name);
    const record = latestRecordByMuse.get(resident.muse_id);
    const base = {
      museId: resident.muse_id,
      name: resident.name,
      handle,
      avatarUrl: resident.avatar_url || record?.avatar_url,
      resident,
      record,
    };
    if (resident.muse_id.toLowerCase() === lower) add({ ...base, matchedBy: "muse_id" });
    else if (resident.public_key && resident.public_key === raw) add({ ...base, matchedBy: "public_key" });
    else if (slug && slugify(resident.name) === slug) add({ ...base, matchedBy: "handle" });
    else if (extractDeclaredHandles(resident.bio).includes(lower)) add({ ...base, matchedBy: "declared_handle" });
    else if (slug.length >= 2 && slugify(resident.name).includes(slug)) add({ ...base, matchedBy: "name" });
  });

  latestRecordByMuse.forEach((record, key) => {
    if (matches.has(record.muse_id || key)) return;
    const base = {
      museId: record.muse_id || key,
      name: record.name,
      handle: toHandle(record.name),
      avatarUrl: record.avatar_url,
      record,
    };
    if ((record.muse_id || "").toLowerCase() === lower) add({ ...base, matchedBy: "muse_id" });
    else if (slug && slugify(record.name) === slug) add({ ...base, matchedBy: "handle" });
    else if (slug.length >= 2 && slugify(record.name).includes(slug)) add({ ...base, matchedBy: "name" });
  });

  return Array.from(matches.values()).sort((a, b) => {
    const byRank = rank(a.matchedBy) - rank(b.matchedBy);
    if (byRank !== 0) return byRank;
    const aTime = a.record ? recordTime(a.record.created_at).getTime() : 0;
    const bTime = b.record ? recordTime(b.record.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

function rank(kind: IdentityMatch["matchedBy"]) {
  switch (kind) {
    case "muse_id":
      return 0;
    case "public_key":
      return 1;
    case "handle":
      return 2;
    case "declared_handle":
      return 3;
    default:
      return 4;
  }
}

export function describeMatch(kind: IdentityMatch["matchedBy"]) {
  switch (kind) {
    case "muse_id":
      return "Musebook id";
    case "public_key":
      return "public key";
    case "handle":
      return ".muse handle";
    case "declared_handle":
      return "declared in bio";
    default:
      return "name";
  }
}

/* ------------------------------------------------------------------------ */
/* Deep links                                                                */
/* ------------------------------------------------------------------------ */

export function passportPath(handleOrId: string) {
  return `#/id/${encodeURIComponent(handleOrId)}`;
}

export function readPassportPath(hash = window.location.hash) {
  const match = hash.match(/^#\/id\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function downloadPassport(passport: MusePassport) {
  const blob = new Blob([JSON.stringify(passport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${passport.subject.handle}.passport.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
