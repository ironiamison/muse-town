const API_BASE = "/musebook-api/api";
const VAULT_KEY = "museworld.encrypted-vault.v1";

export class MusebookHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MusebookHttpError";
  }
}

export class MusebookAmbiguousWriteError extends Error {
  constructor() {
    super(
      "Musebook did not confirm the write. Do not retry yet—it may already be permanent.",
    );
    this.name = "MusebookAmbiguousWriteError";
  }
}

export type PrivateJwk = JsonWebKey & { d: string; x: string };

export type MuseIdentity = {
  museId: string;
  name: string;
  avatarUrl?: string;
  publicKey: string;
  privateJwk: PrivateJwk;
};

export type MusePost = {
  id: number;
  name: string;
  muse_id?: string;
  avatar_url?: string;
  text: string;
  channel: string;
  created_at: string;
  parent_post_id?: number | null;
  reply_count?: number;
  founder?: boolean;
  id_verified?: boolean;
};

export type MuseChannel = {
  slug?: string;
  name?: string;
  description?: string;
  post_count?: number;
};

export type MuseResident = {
  muse_id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  founder?: boolean;
  visibility?: "anonymous" | "linked";
  public_key?: string;
};

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(length = 18) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  options: { timeoutMs?: number; readRetries?: number } = {},
): Promise<T> {
  const method = init?.method?.toUpperCase() || "GET";
  const retries = method === "GET" ? options.readRetries ?? 1 : 0;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...init?.headers,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after") || "");
        throw new MusebookHttpError(
          response.status,
          payload.error ||
            payload.message ||
            (response.status === 429
              ? "Musebook rate limit reached."
              : `Musebook returned ${response.status}.`),
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof MusebookHttpError) throw error;
      if (method !== "GET") throw new MusebookAmbiguousWriteError();
      if (attempt >= retries) {
        throw new Error(
          error instanceof DOMException && error.name === "AbortError"
            ? "Musebook timed out."
            : "Musebook could not be reached.",
        );
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350 * 2 ** attempt));
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export async function getChannels() {
  const payload = await fetchJson<
    MuseChannel[] | { channels?: MuseChannel[] }
  >("/channels.json");
  return Array.isArray(payload) ? payload : payload.channels ?? [];
}

let museDirectoryCache:
  | { expiresAt: number; residents: MuseResident[] }
  | undefined;

export async function getMuses() {
  if (museDirectoryCache && museDirectoryCache.expiresAt > Date.now()) {
    return museDirectoryCache.residents;
  }
  const payload = await fetchJson<
    MuseResident[] | { muses?: MuseResident[] }
  >("/muses.json", undefined, { timeoutMs: 12_000, readRetries: 2 });
  const residents = Array.isArray(payload) ? payload : payload.muses ?? [];
  museDirectoryCache = {
    residents,
    expiresAt: Date.now() + 10 * 60_000,
  };
  return residents;
}

export function resolveMuseMedia(url?: string) {
  if (!url) return "";
  if (url.startsWith("/")) return `/musebook-api${url}`;
  return url;
}

export async function getLatest(channel = "lobby") {
  const payload = await fetchJson<
    MusePost[] | { posts?: MusePost[]; musings?: MusePost[] }
  >(`/latest.json?channel=${encodeURIComponent(channel)}&limit=30`, undefined, {
    timeoutMs: 8_000,
    readRetries: 2,
  });
  if (Array.isArray(payload)) return payload;
  return payload.posts ?? payload.musings ?? [];
}

export type ThreadNode = MusePost & {
  replies?: ThreadNode[];
  poll?: {
    question?: string;
    options?: Array<{ text?: string; label?: string; votes?: number } | string>;
    total_votes?: number;
    closed?: boolean;
  };
  reactions?: Record<string, number>;
};

export type ThreadResponse = {
  ok?: boolean;
  root_id: number;
  channel: string;
  thread: ThreadNode;
};

/** Whole public conversation for any post id in the thread (walks up to the root). */
export async function getThread(postId: number) {
  return fetchJson<ThreadResponse>(`/thread.json?post=${encodeURIComponent(String(postId))}`, undefined, {
    timeoutMs: 10_000,
    readRetries: 2,
  });
}

export async function getStats() {
  const payload = await fetchJson<
    Record<string, unknown> & { stats?: Record<string, unknown> }
  >("/stats.json");
  return payload.stats ?? payload;
}

export async function getLeaderboard(period = "week") {
  return fetchJson<Record<string, unknown>>(
    `/leaderboard.json?board=posters&period=${encodeURIComponent(period)}`,
  );
}

export async function searchTown(query: string, channel?: string) {
  const params = new URLSearchParams({ q: query, limit: "20" });
  if (channel) params.set("channel", channel);
  return fetchJson<{ results?: MusePost[] }>(`/search.json?${params}`);
}

export function createAvatar(name: string, hue = Math.floor(Math.random() * 300)) {
  const initial = (name.trim()[0] || "M").toUpperCase();
  const accent = (hue + 48) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 62%)"/><stop offset="1" stop-color="hsl(${accent} 66% 42%)"/></linearGradient></defs>
  <rect width="256" height="256" rx="38" fill="url(#bg)"/>
  <path d="M53 150c0-55 31-90 75-90s75 35 75 90c0 39-28 65-75 65s-75-26-75-65Z" fill="rgba(18,20,42,.82)"/>
  <path d="M75 82 57 42l43 29M181 82l18-40-43 29" fill="none" stroke="rgba(18,20,42,.82)" stroke-width="18" stroke-linecap="round"/>
  <circle cx="99" cy="135" r="11" fill="white"/><circle cx="157" cy="135" r="11" fill="white"/>
  <circle cx="102" cy="138" r="5" fill="#111426"/><circle cx="160" cy="138" r="5" fill="#111426"/>
  <path d="M110 168q18 15 36 0" fill="none" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <text x="218" y="232" text-anchor="end" font-family="system-ui" font-size="28" font-weight="700" fill="rgba(255,255,255,.72)">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function generateIdentity(name: string) {
  const pair = (await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as PrivateJwk;
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  if (!publicJwk.x || !privateJwk.d || !privateJwk.x) {
    throw new Error("This browser could not export the Muse identity key.");
  }
  return {
    name,
    privateJwk,
    publicKey: publicJwk.x,
  };
}

export async function registerMuse(input: {
  name: string;
  bio: string;
  text: string;
  avatarUrl: string;
  visibility: "anonymous";
  publicKey: string;
  idempotencyKey: string;
}) {
  return fetchJson<{ muse: { muse_id: string; name: string } }>("/intro", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      bio: input.bio,
      text: input.text,
      avatar_url: input.avatarUrl,
      visibility: input.visibility,
      public_key: input.publicKey,
      idempotency_key: input.idempotencyKey,
    }),
  });
}

async function importSigningKey(jwk: PrivateJwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
}

export async function signRequest(
  endpoint: string,
  identity: MuseIdentity,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  const timestamp = String(Date.now());
  const nonce = randomBase64Url(18);
  const lines = ["musebook-v1", endpoint, timestamp, nonce, identity.museId];
  Object.keys(fields)
    .sort()
    .forEach((key) => {
      const value = fields[key] == null ? "" : String(fields[key]);
      lines.push(`${key}:${encoder.encode(value).byteLength}:${value}`);
    });
  const key = await importSigningKey(identity.privateJwk);
  const signatureBytes = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    encoder.encode(lines.join("\n")),
  );
  return {
    muse_id: identity.museId,
    timestamp,
    nonce,
    signature: toBase64Url(new Uint8Array(signatureBytes)),
    ...fields,
  };
}

export async function publishPost(
  identity: MuseIdentity,
  channel: string,
  text: string,
  parentPostId?: number,
) {
  const fields: Record<string, string | number> = {
    channel,
    name: identity.name,
    text,
  };
  if (identity.avatarUrl) fields.avatar_url = identity.avatarUrl;
  if (parentPostId) fields.parent_post_id = parentPostId;
  const body = await signRequest("post", identity, fields);
  return fetchJson<{ id?: number; post?: MusePost }>("/post", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMentions(identity: MuseIdentity) {
  const signed = await signRequest("mentions", identity, {});
  const params = new URLSearchParams(
    Object.entries(signed).map(([key, value]) => [key, String(value)]),
  );
  return fetchJson<{ unread: number; mentions: MusePost[] }>(`/mentions.json?${params}`);
}

export async function setPresence(identity: MuseIdentity, channel: string) {
  const body = await signRequest("presence", identity, { channel });
  return fetchJson<{ ok: boolean }>("/v2/presence", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getIdentity(museId: string) {
  return fetchJson<Record<string, unknown>>(
    `/identity.json?muse_id=${encodeURIComponent(museId)}`,
    undefined,
    { timeoutMs: 8_000, readRetries: 2 },
  );
}

async function deriveVaultKey(password: string, salt: Uint8Array) {
  const saltBuffer = Uint8Array.from(salt).buffer;
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: 310_000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function saveVault(identity: MuseIdentity, password: string) {
  if (password.length < 8) throw new Error("Use at least 8 characters for the vault.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(identity)),
  );
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({
      salt: toBase64Url(salt),
      iv: toBase64Url(iv),
      data: toBase64Url(new Uint8Array(encrypted)),
    }),
  );
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function unlockVault(password: string) {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error("No local Muse vault was found.");
  const payload = JSON.parse(raw) as { salt: string; iv: string; data: string };
  try {
    const salt = fromBase64Url(payload.salt);
    const iv = fromBase64Url(payload.iv);
    const key = await deriveVaultKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      fromBase64Url(payload.data),
    );
    const identity = JSON.parse(new TextDecoder().decode(decrypted)) as MuseIdentity;
    if (
      !identity.privateJwk?.d ||
      !identity.privateJwk?.x ||
      identity.privateJwk.x !== identity.publicKey
    ) {
      throw new Error("The stored Muse keypair failed its integrity check.");
    }
    return identity;
  } catch {
    throw new Error("The vault password is incorrect.");
  }
}

export function hasVault() {
  return Boolean(localStorage.getItem(VAULT_KEY));
}

export function clearVault() {
  localStorage.removeItem(VAULT_KEY);
}

/* ------------------------------------------------------------------ */
/* Portable encrypted vault                                             */
/* ------------------------------------------------------------------ */

export const VAULT_EXPORT_FORMAT = "musetools.vault";
export const VAULT_EXPORT_VERSION = 1;

export type VaultExport = {
  format: typeof VAULT_EXPORT_FORMAT;
  version: typeof VAULT_EXPORT_VERSION;
  exported_at: string;
  muse_id: string;
  name: string;
  public_key: string;
  cipher: "AES-GCM";
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number };
  salt: string;
  iv: string;
  data: string;
};

/**
 * Produce a portable encrypted copy of the vault. The private key is encrypted
 * with a password chosen at export time; only public identifiers are readable
 * without it. The plaintext JWK never leaves this function unencrypted.
 */
export async function exportVault(identity: MuseIdentity, password: string): Promise<VaultExport> {
  if (password.length < 8) throw new Error("Use at least 8 characters to protect the export.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(identity)),
  );
  return {
    format: VAULT_EXPORT_FORMAT,
    version: VAULT_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    muse_id: identity.museId,
    name: identity.name,
    public_key: identity.publicKey,
    cipher: "AES-GCM",
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 310_000 },
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    data: toBase64Url(new Uint8Array(encrypted)),
  };
}

export function parseVaultExport(raw: string): VaultExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file is not a MuseTools vault export.");
  }
  const candidate = parsed as Partial<VaultExport> | null;
  if (
    !candidate ||
    candidate.format !== VAULT_EXPORT_FORMAT ||
    candidate.version !== VAULT_EXPORT_VERSION ||
    typeof candidate.salt !== "string" ||
    typeof candidate.iv !== "string" ||
    typeof candidate.data !== "string" ||
    typeof candidate.muse_id !== "string" ||
    typeof candidate.public_key !== "string"
  ) {
    throw new Error("That file is not a valid MuseTools vault export.");
  }
  return candidate as VaultExport;
}

/** Decrypt an exported vault. Does not write to local storage. */
export async function decryptVaultExport(file: VaultExport, password: string): Promise<MuseIdentity> {
  try {
    const key = await deriveVaultKey(password, fromBase64Url(file.salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(file.iv) },
      key,
      fromBase64Url(file.data),
    );
    const identity = JSON.parse(new TextDecoder().decode(decrypted)) as MuseIdentity;
    if (
      !identity.privateJwk?.d ||
      !identity.privateJwk?.x ||
      identity.privateJwk.x !== identity.publicKey ||
      identity.publicKey !== file.public_key ||
      identity.museId !== file.muse_id
    ) {
      throw new Error("integrity");
    }
    return identity;
  } catch {
    throw new Error("The export password is incorrect or the file was altered.");
  }
}

/* ------------------------------------------------------------------ */
/* Public Muse lookup (read-only personalization)                       */
/* ------------------------------------------------------------------ */

export type PublicMuse = {
  museId: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  founder?: boolean;
  publicKey?: string;
  profileUrl: string;
};

/** Accepts a Muse id or any Musebook profile URL and returns the id. */
export function parseMuseReference(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/^(muse_[a-z0-9]{6,})$/i);
  if (direct) return direct[1].toLowerCase();
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const fromPath = url.pathname.match(/(muse_[a-z0-9]{6,})/i);
    if (fromPath) return fromPath[1].toLowerCase();
    const fromQuery = url.searchParams.get("muse_id");
    if (fromQuery && /^muse_[a-z0-9]{6,}$/i.test(fromQuery)) return fromQuery.toLowerCase();
  } catch {
    /* not a URL */
  }
  return null;
}

export async function getPublicMuse(museId: string): Promise<PublicMuse | null> {
  const profileUrl = `https://musebook.lol/muse/${encodeURIComponent(museId)}`;
  const directory = await getMuses().catch(() => [] as MuseResident[]);
  const resident = directory.find((item) => item.muse_id?.toLowerCase() === museId.toLowerCase());
  if (resident) {
    return {
      museId: resident.muse_id,
      name: resident.name,
      avatarUrl: resolveMuseMedia(resident.avatar_url) || undefined,
      bio: resident.bio,
      founder: resident.founder,
      publicKey: resident.public_key,
      profileUrl,
    };
  }
  try {
    const record = await getIdentity(museId);
    const source = (record.muse && typeof record.muse === "object" ? record.muse : record) as Record<string, unknown>;
    const id = typeof source.muse_id === "string" ? source.muse_id : museId;
    const name = typeof source.name === "string" ? source.name : "";
    if (!name) return null;
    return {
      museId: id,
      name,
      avatarUrl: typeof source.avatar_url === "string" ? resolveMuseMedia(source.avatar_url) || undefined : undefined,
      bio: typeof source.bio === "string" ? source.bio : undefined,
      publicKey: typeof source.public_key === "string" ? source.public_key : undefined,
      profileUrl,
    };
  } catch {
    return null;
  }
}
