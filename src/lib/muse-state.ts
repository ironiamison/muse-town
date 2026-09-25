import type { Execution } from "./execution.js";
import type { MuseIdentity, PublicMuse } from "./musebook.js";
import type { MuseVoiceState } from "./muse-voice.js";
import { powerAvailability, powerForCapability, type PowerAvailability, type PowerId } from "./powers.js";
import type { MuseSkill } from "./skills.js";

/**
 * A connected Muse is either:
 *  - a local signer (the private key is unlocked in this browser), or
 *  - a public profile followed read-only (cannot publish).
 *
 * Neither is official Meta authentication. A Meta Muse reaches MuseTools by
 * reading the public connector descriptor and calling the API with its own
 * self-certifying Ed25519 identity.
 */
export type ConnectedMuse = {
  museId: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  authority: "signer" | "public";
  profileUrl: string;
};

export type MuseState = {
  muse: ConnectedMuse | null;
  canSign: boolean;
  /** Executions that reference this Muse as requester or executor. */
  mine: Execution[];
  active: Execution[];
  completed: Execution[];
  /** Completed executions with returned proof, newest first. */
  returned: Execution[];
  powers: Record<PowerId, { availability: PowerAvailability; count: number; note: string }>;
  /** Powers this Muse has actually used, derived from its signed history. */
  used: PowerId[];
  voice: MuseVoiceState;
  payment: { walletConnected: boolean; x402: "buyer_live" };
};

const ACTIVE = new Set(["CREATED", "MATCHING", "CLAIMED", "IN_PROGRESS", "PROOF_SUBMITTED", "VERIFYING"]);

export function connectedFromIdentity(identity: MuseIdentity): ConnectedMuse {
  return {
    museId: identity.museId,
    name: identity.name,
    avatarUrl: identity.avatarUrl,
    authority: "signer",
    profileUrl: `/api/port/v1/records?muse_id=${encodeURIComponent(identity.museId)}`,
  };
}

export function connectedFromPublic(profile: PublicMuse): ConnectedMuse {
  return {
    museId: profile.museId,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    authority: "public",
    profileUrl: profile.profileUrl,
  };
}

export function deriveMuseState(input: {
  identity: MuseIdentity | null;
  publicMuse: PublicMuse | null;
  executions: Execution[];
  skills: MuseSkill[];
  voice: MuseVoiceState;
  walletConnected: boolean;
}): MuseState {
  const muse = input.identity
    ? connectedFromIdentity(input.identity)
    : input.publicMuse
      ? connectedFromPublic(input.publicMuse)
      : null;
  const mine = muse
    ? input.executions.filter(
        (execution) => execution.requester.id === muse.museId || execution.executor?.id === muse.museId,
      )
    : [];
  const active = mine.filter((execution) => ACTIVE.has(execution.status));
  const completed = mine.filter((execution) => execution.status === "COMPLETE");
  const returned = completed
    .filter((execution) => execution.proof.length > 0)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const used = [...new Set(mine.map((execution) => powerForCapability(execution.capability.id)))];

  return {
    muse,
    canSign: Boolean(input.identity),
    mine,
    active,
    completed,
    returned,
    powers: powerAvailability(input.skills, true),
    used,
    voice: input.voice,
    payment: { walletConnected: input.walletConnected, x402: "buyer_live" },
  };
}

/** Possessive display name: "Kasia's Muse" / "Jamison's Muse" style, but for Muse names themselves. */
export function museHeadline(muse: ConnectedMuse | null) {
  if (!muse) return "YOUR MUSE";
  return muse.name.toUpperCase();
}

const PUBLIC_KEY = "musetools.public-muse.v1";

export function readStoredPublicMuse(): PublicMuse | null {
  try {
    const raw = localStorage.getItem(PUBLIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicMuse;
    return parsed && typeof parsed.museId === "string" && typeof parsed.name === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function storePublicMuse(profile: PublicMuse | null) {
  if (!profile) localStorage.removeItem(PUBLIC_KEY);
  else localStorage.setItem(PUBLIC_KEY, JSON.stringify(profile));
}
