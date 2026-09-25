import { MusebookAmbiguousWriteError, MusebookHttpError, signRequest, type MuseIdentity } from "./musebook";
import {
  PORT_CHANNEL,
  recordKind,
  type PortContribution,
  type PortHuman,
  type PortMuse,
  type PortReward,
  type PortTask,
  type PortWalletLink,
} from "./port";
import type { FoundingCampaign, FoundingRewardPolicy } from "./founding";

/* --------------------------------------------------------------------------
   PORT API client — talks only to the MuseTools ledger.
   Writes are Ed25519 signed envelopes; the private key never leaves the
   browser. `public_key` rides inside the signed fields so a self-certifying
   identity needs no registration anywhere.
   -------------------------------------------------------------------------- */

export type PortTaskSnapshot = {
  ok: true;
  protocol: "port/1";
  source: "ledger";
  channel: string;
  partial: boolean;
  head: { seq: number; hash: string } | null;
  count: number;
  tasks: PortTask[];
  walletLinks: PortWalletLink[];
  humans: PortHuman[];
  muses: PortMuse[];
  contributions: PortContribution[];
  rewards: PortReward[];
};

export type LedgerWriteResult = {
  id: number;
  hash: string;
  taskId: number | null;
  kind: string;
};

export type FoundingCampaignPayload = FoundingCampaign & {
  ok: true;
  protocol: string;
  campaign: "first-100-working-muses";
  funding: {
    source: "pons_creator_fees";
    network: string;
    chain_id: number;
    status: "configured" | "awaiting_coin_launch";
    token_address: string | null;
    creator_wallet: string | null;
    reward_issuer: string | null;
    issuance_active: boolean;
    balance_reported: boolean;
    claimable_amount: string | null;
    claimable_asset: string | null;
    curve_amount: string | null;
    graduation_progress_percent: number | null;
    graduated: boolean;
    custody: false;
    note: string;
  };
  policy: FoundingRewardPolicy;
};

export type PonsFundingPayload = {
  ok: true;
  protocol: string;
  funding: {
    source: "pons_creator_fees";
    status: "awaiting_coin_launch" | "configured" | "rpc_unavailable";
    chain_id: 4663;
    network: "Robinhood Chain";
    token_address: string | null;
    creator_wallet: string | null;
    creator_wallet_source: "pons_v2_factory" | null;
    configured_creator_wallet_matches: boolean | null;
    fee_escrow: string;
    claimable_native_wei: string | null;
    claimable_native_eth: string | null;
    pair_token_address: string | null;
    pair_token_symbol: string | null;
    pair_token_decimals: number | null;
    claimable_pair_token_atomic: string | null;
    claimable_pair_token_amount: string | null;
    wallet_pair_token_atomic: string | null;
    wallet_pair_token_amount: string | null;
    curve_address: string | null;
    curve_pair_token_atomic: string | null;
    curve_pair_token_amount: string | null;
    graduation_threshold_atomic: string | null;
    graduation_threshold_amount: string | null;
    graduation_progress_percent: number | null;
    graduation_phase: number | null;
    graduated: boolean;
    wallet_native_wei: string | null;
    wallet_native_eth: string | null;
    token_contract_verified: boolean;
    onchain_checked: boolean;
    checked_at: string | null;
    explorer: string;
    claim_requires_creator_wallet: true;
    unswept_fees_included: false;
    note: string;
  };
  payout: {
    method: "creator_wallet_direct";
    custody: false;
    escrow_claim_function: "claim() | claimToken(address)";
    automatic: false;
    note: string;
  };
};

export class LedgerNotConfiguredError extends Error {
  constructor() {
    super("The MuseTools ledger is not configured on this deployment yet.");
    this.name = "LedgerNotConfiguredError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`PORT API returned ${response.status}.`);
  return (await response.json()) as T;
}

export async function getPortTaskSnapshot(limit = 50) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/port/v1/tasks?limit=${Math.min(Math.max(limit, 1), 50)}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await readJson<PortTaskSnapshot | { ok: false; error?: { code?: string; message?: string } }>(response);
    if (!payload.ok) {
      if (payload.error?.code === "LEDGER_NOT_CONFIGURED") throw new LedgerNotConfiguredError();
      throw new Error(payload.error?.message || "PORT API returned an invalid response.");
    }
    if (!Array.isArray(payload.tasks)) throw new Error("PORT API returned an invalid response.");
    return {
      ...payload,
      humans: payload.humans ?? [],
      walletLinks: payload.walletLinks ?? [],
      muses: payload.muses ?? [],
      contributions: payload.contributions ?? [],
      rewards: payload.rewards ?? [],
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getFoundingCampaign() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/founding", {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await readJson<
      FoundingCampaignPayload | { ok: false; error?: { code?: string; message?: string } }
    >(response);
    if (!payload.ok) {
      if (payload.error?.code === "LEDGER_NOT_CONFIGURED") throw new LedgerNotConfiguredError();
      throw new Error(payload.error?.message || "The founding campaign could not be read.");
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getPonsFunding() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/pons", {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await readJson<
      PonsFundingPayload | { ok: false; error?: { message?: string } }
    >(response);
    if (!payload.ok) throw new Error(payload.error?.message || "Pons funding could not be read.");
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function portWritePath(text: string, parentPostId?: number) {
  const kind = recordKind(text);
  if (!kind) throw new Error("This text carries no [port.* v1] marker.");
  if (parentPostId) return `/api/port/v1/events?task=${parentPostId}`;
  if (kind === "task") return "/api/port/v1/tasks";
  if (kind === "wallet") return "/api/port/v1/wallet-links";
  if (kind === "human") return "/api/port/v1/humans";
  if (kind === "muse") return "/api/port/v1/muses";
  if (kind === "contribution") return "/api/port/v1/contributions";
  if (kind === "reward") return "/api/port/v1/rewards";
  throw new Error("A lifecycle event needs the parent task id.");
}

/** Sign and append one record. Returns the ledger id (the task ref for tasks). */
export async function publishPortRecord(identity: MuseIdentity, text: string, parentPostId?: number): Promise<LedgerWriteResult> {
  const fields: Record<string, string | number> = {
    channel: PORT_CHANNEL,
    name: identity.name,
    text,
    public_key: identity.publicKey,
  };
  if (identity.avatarUrl) fields.avatar_url = identity.avatarUrl;
  if (parentPostId) fields.parent_post_id = parentPostId;
  const signed = await signRequest("post", identity, fields);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(portWritePath(text, parentPostId), {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(signed),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
      record?: { id: number; hash: string; kind: string };
      taskId?: number | null;
    };
    if (!response.ok) {
      if (payload.error?.code === "LEDGER_NOT_CONFIGURED") throw new LedgerNotConfiguredError();
      throw new MusebookHttpError(response.status, payload.error?.message || `PORT API returned ${response.status}.`);
    }
    if (!payload.record) throw new Error("The ledger did not return the appended record.");
    return { id: payload.record.id, hash: payload.record.hash, kind: payload.record.kind, taskId: payload.taskId ?? null };
  } catch (error) {
    if (error instanceof MusebookHttpError || error instanceof LedgerNotConfiguredError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new MusebookAmbiguousWriteError();
    throw error instanceof Error ? error : new MusebookAmbiguousWriteError();
  } finally {
    window.clearTimeout(timeout);
  }
}
