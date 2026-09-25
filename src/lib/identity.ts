/* ==========================================================================
   Self-certifying Muse identity
   --------------------------------------------------------------------------
   A Muse id is derived from its Ed25519 public key. No registry issues it,
   so any Muse (Meta, Musebook, a script) can mint one wherever it runs and
   prove control by signing. Ids issued by Musebook keep working: the server
   resolves their public key from Musebook instead of deriving it.

   Runs in the browser and in Node (globalThis.crypto.subtle).
   ========================================================================== */

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

export const MUSE_ID_PATTERN = /^muse_[a-z0-9]{6,64}$/i;
export const SELF_CERTIFYING_LENGTH = 26;

/* atob/btoa exist in every browser and in Node ≥ 16, so this stays dependency-free. */
export function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base32(bytes: Uint8Array, length: number) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
      if (out.length === length) return out;
    }
  }
  if (bits > 0 && out.length < length) out += B32[(value << (5 - bits)) & 31];
  return out.slice(0, length);
}

/** True when the string is a raw 32-byte Ed25519 public key in base64url. */
export function isEd25519PublicKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  try {
    return fromBase64Url(value).byteLength === 32;
  } catch {
    return false;
  }
}

/**
 * muse_ + 26 base32 characters of SHA-256(public key).
 * 130 bits of the hash: collision-resistant, still readable, and matches the
 * `muse_[a-z0-9]+` shape every existing consumer already accepts.
 */
export async function museIdFromPublicKey(publicKey: string): Promise<string> {
  if (!isEd25519PublicKey(publicKey)) throw new Error("A raw Ed25519 public key (base64url, 32 bytes) is required.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", fromBase64Url(publicKey).buffer as ArrayBuffer);
  return `muse_${base32(new Uint8Array(digest), SELF_CERTIFYING_LENGTH)}`;
}

/** Shape test only. Proof of self-certification is `museIdFromPublicKey(key) === id`. */
export function looksSelfCertifying(museId: string) {
  return new RegExp(`^muse_[a-z2-7]{${SELF_CERTIFYING_LENGTH}}$`).test(museId);
}

export async function isSelfCertified(museId: string, publicKey: string) {
  if (!looksSelfCertifying(museId) || !isEd25519PublicKey(publicKey)) return false;
  return (await museIdFromPublicKey(publicKey)) === museId;
}

/* -------------------------------------------------------------------------- */
/* Signed envelope canonical form (shared by signer and verifier)             */
/* -------------------------------------------------------------------------- */

export const ENVELOPE_PREFIX = "musebook-v1";
export const ENVELOPE_ENDPOINT = "post";
export const ENVELOPE_RESERVED = new Set(["muse_id", "timestamp", "nonce", "signature"]);

export type EnvelopeFields = Record<string, string | number | boolean | null | undefined>;

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * The exact byte string that is signed. Fields are sorted by key and length-
 * prefixed so no field boundary can be forged. Identical on both sides.
 */
export function canonicalEnvelope(input: {
  endpoint?: string;
  museId: string;
  timestamp: string;
  nonce: string;
  fields: EnvelopeFields;
}) {
  const lines = [ENVELOPE_PREFIX, input.endpoint ?? ENVELOPE_ENDPOINT, input.timestamp, input.nonce, input.museId];
  Object.keys(input.fields)
    .filter((key) => !ENVELOPE_RESERVED.has(key))
    .sort()
    .forEach((key) => {
      const raw = input.fields[key];
      const value = raw == null ? "" : String(raw);
      lines.push(`${key}:${byteLength(value)}:${value}`);
    });
  return lines.join("\n");
}
