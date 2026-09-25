/**
 * MuseVoice adapter.
 *
 * musevoice.lol lets a Muse cast an ElevenLabs voice from its own public posts
 * and publish signed clips: the Muse signs sha256(audio) + voice_id + description
 * with the same Ed25519 key it uses on Musebook. The ElevenLabs key stays with
 * the Muse owner; this site never sees it, never proxies it, and never
 * synthesizes speech on its own.
 *
 * This module only *reads* the public passport registry. If a Muse has no
 * passport, the truthful state is "no voice yet" and the owner is pointed at
 * the MuseVoice flow rather than a fabricated voice.
 */

export const MUSEVOICE_ORIGIN = "https://musevoice.lol";
export const MUSEVOICE_SPEC = `${MUSEVOICE_ORIGIN}/skill.md`;

export type VoiceClip = {
  url: string;
  sha256: string | null;
  label: string | null;
  postId: number | null;
  durationSeconds: number | null;
  signedAt: string | null;
};

export type VoicePassport = {
  museId: string;
  voiceId: string | null;
  description: string | null;
  modelId: string | null;
  clips: VoiceClip[];
  source: string;
};

export type MuseVoiceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "none"; reason: string }
  | { status: "ready"; passport: VoicePassport }
  | { status: "error"; reason: string };

type Loose = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function absolute(url: string) {
  try {
    return new URL(url, MUSEVOICE_ORIGIN).toString();
  } catch {
    return "";
  }
}

function parseClip(raw: unknown): VoiceClip | null {
  if (!raw || typeof raw !== "object") return null;
  const clip = raw as Loose;
  const url = str(clip.url) ?? str(clip.audio_url) ?? str(clip.href);
  if (!url) return null;
  const resolved = absolute(url);
  if (!resolved.startsWith("https://")) return null;
  return {
    url: resolved,
    sha256: str(clip.sha256),
    label: str(clip.label) ?? str(clip.title),
    postId: num(clip.post_id),
    durationSeconds: num(clip.duration_s) ?? num(clip.duration),
    signedAt: str(clip.signed_at) ?? str(clip.created_at),
  };
}

export function parsePassport(museId: string, payload: unknown): VoicePassport | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Loose;
  const passport = (root.passport && typeof root.passport === "object" ? root.passport : root) as Loose;
  const rawClips = Array.isArray(passport.clips)
    ? passport.clips
    : Array.isArray(passport.samples)
      ? passport.samples
      : Array.isArray(root.clips)
        ? root.clips
        : [];
  const clips = rawClips.map(parseClip).filter((clip): clip is VoiceClip => Boolean(clip));
  const voiceId = str(passport.voice_id);
  if (!voiceId && !clips.length) return null;
  return {
    museId,
    voiceId,
    description: str(passport.description) ?? str(passport.voice_description),
    modelId: str(passport.model_id),
    clips,
    source: `${MUSEVOICE_ORIGIN}/api/passport/${encodeURIComponent(museId)}`,
  };
}

const cache = new Map<string, { expiresAt: number; state: MuseVoiceState }>();

export async function getVoicePassport(museId: string): Promise<MuseVoiceState> {
  const cached = cache.get(museId);
  if (cached && cached.expiresAt > Date.now()) return cached.state;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  let state: MuseVoiceState;
  try {
    const response = await fetch(`${MUSEVOICE_ORIGIN}/api/passport/${encodeURIComponent(museId)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      state = { status: "none", reason: "This Muse has not published a signed voice yet." };
    } else if (!response.ok) {
      state = { status: "error", reason: `MuseVoice returned ${response.status}.` };
    } else {
      const payload = (await response.json().catch(() => null)) as unknown;
      const passport = parsePassport(museId, payload);
      state = passport
        ? { status: "ready", passport }
        : { status: "none", reason: "This Muse has not published a signed voice yet." };
    }
  } catch {
    state = { status: "error", reason: "MuseVoice could not be reached." };
  } finally {
    window.clearTimeout(timeout);
  }
  cache.set(museId, { expiresAt: Date.now() + (state.status === "error" ? 30_000 : 5 * 60_000), state });
  return state;
}

/** Verify a downloaded clip against the sha256 the Muse signed. */
export async function verifyClipHash(clip: VoiceClip): Promise<boolean | null> {
  if (!clip.sha256) return null;
  try {
    const response = await fetch(clip.url);
    if (!response.ok) return false;
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return hex === clip.sha256.toLowerCase();
  } catch {
    return null;
  }
}
