import {
  PORT_CHANNEL,
  foldTask,
  humanReputation,
  meetsClearance,
  parseContributionRecord,
  parseTaskRecord,
  parseHumanRecord,
  parseMuseRecord,
  parseRewardRecord,
  parseWalletRecord,
  recordKind,
  screenTask,
  type PortTask,
} from "../../../src/lib/port.js";
import type { ThreadNode } from "../../../src/lib/musebook.js";
import { LedgerNotConfiguredError, ledgerConfigured } from "../../_lib/db.js";
import {
  DuplicateNonceError,
  GENESIS_HASH,
  appendRecord,
  auditChain,
  boundKey,
  getRecord,
  log as ledgerLog,
  publicRecord,
  recordsBy,
  snapshot,
  taskFromId as ledgerTaskFromId,
  verifyEnvelope,
  type LedgerRecord,
  type SignedEnvelope,
  type Verified,
} from "../../_lib/ledger.js";
import { MUSE_ID_PATTERN, looksSelfCertifying } from "../../../src/lib/identity.js";
import { readPonsFundingState, verifyPonsTokenPayout } from "../../_lib/pons.js";
import { verifyMessage } from "viem";

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

const API_VERSION = "port/1";
const EVENT_KINDS = new Set(["accept", "assign", "departed", "onsite", "proof", "verify", "settle", "cancel", "dispute"]);

function cors(response: ApiResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("X-Port-Protocol", API_VERSION);
}

function fail(response: ApiResponse, status: number, code: string, message: string, details?: unknown) {
  response.status(status).json({
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

function pathParts(request: ApiRequest) {
  const raw = request.query.route || request.query["...path"] || request.query.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? raw.split("/").filter(Boolean) : ["status"];
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boundedInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function taskUpdatedAt(task: PortTask) {
  return Math.max(task.createdAt, ...task.events.map((event) => event.at));
}

function serializeTask(task: PortTask) {
  return {
    ...task,
    links: {
      api: `/api/port/v1/task?id=${task.id}`,
      record: `/api/port/v1/record?id=${task.id}`,
      page: `/executions/${task.id}`,
    },
    updatedAt: taskUpdatedAt(task),
  };
}

/* Exports kept for api/network.ts */
export async function taskFromId(postId: number) {
  return ledgerTaskFromId(postId);
}

export async function taskSnapshot(limit: number) {
  const result = await snapshot(limit);
  return { ...result, partial: false, upstreamAvailable: true };
}

function taskMatches(task: PortTask, request: ApiRequest) {
  const state = first(request.query.state)?.toUpperCase();
  const city = first(request.query.city)?.toLowerCase();
  const category = first(request.query.category)?.toUpperCase();
  const creator = first(request.query.creator)?.toLowerCase();
  const assigned = first(request.query.assigned)?.toLowerCase();
  if (state && task.state !== state) return false;
  if (city && task.city.toLowerCase() !== city) return false;
  if (category && task.category !== category) return false;
  if (creator && ![task.creator.museId, task.creator.name].some((value) => value.toLowerCase() === creator)) return false;
  if (assigned && !task.assigned) return false;
  if (assigned && task.assigned && ![task.assigned.museId, task.assigned.name].some((value) => value.toLowerCase() === assigned)) {
    return false;
  }
  return true;
}

function validateTaskText(envelope: Pick<SignedEnvelope, "name" | "muse_id" | "text" | "channel" | "parent_post_id">) {
  if (envelope.parent_post_id !== undefined) return "A task must be a root record.";
  const parsed = parseTaskRecord({
    id: 1,
    name: envelope.name,
    muse_id: envelope.muse_id,
    text: envelope.text,
    channel: envelope.channel,
    created_at: new Date().toISOString(),
  });
  if (!parsed) return "The signed text is not a valid [port.task v1] record.";
  const safety = screenTask(`${parsed.title}\n${parsed.objective}\n${parsed.proofRequired.map((proof) => proof.description).join("\n")}`);
  if (!safety.ok) return safety.reason || "The task did not pass the safety screen.";
  if (parsed.executor === "human" && !parsed.city) return "A public city is required for physical human work.";
  if (parsed.reward === null || parsed.reward <= 0 || !parsed.asset) return "A positive reward amount and asset are required.";
  if (!parsed.proofRequired.length) return "At least one proof requirement is required.";
  return null;
}

function validateHumanText(envelope: SignedEnvelope) {
  if (envelope.parent_post_id !== undefined) return "An availability declaration must be a root record.";
  const parsed = parseHumanRecord({
    id: 1,
    name: envelope.name,
    muse_id: envelope.muse_id,
    text: envelope.text,
    channel: envelope.channel,
    created_at: new Date().toISOString(),
  });
  if (!parsed) return "The signed text is not a valid [port.human v1] record.";
  if (!parsed.region) return "A public region (city) is required.";
  if (!parsed.capabilities.length) return "Declare at least one capability.";
  return null;
}

function eventFoldResult(task: PortTask, envelope: SignedEnvelope) {
  if (task.state === "EXPIRED" || task.state === "SETTLED" || task.state === "CANCELLED") return null;
  const candidateId = Number.MAX_SAFE_INTEGER;
  const candidate: ThreadNode = {
    id: candidateId,
    muse_id: envelope.muse_id,
    name: envelope.name,
    avatar_url: envelope.avatar_url,
    text: envelope.text,
    channel: envelope.channel,
    created_at: new Date().toISOString(),
    parent_post_id: task.id,
    replies: [],
  };
  const replay: ThreadNode = {
    ...task.record,
    replies: [...task.events.map((event) => ({ ...event.post, replies: [] })), candidate],
  };
  const root = parseTaskRecord(replay);
  if (!root) return null;
  const folded = foldTask(root, replay);
  return folded.events.some((event) => event.post.id === candidateId) ? folded : null;
}

function ledgerError(response: ApiResponse, error: unknown) {
  if (error instanceof LedgerNotConfiguredError) {
    fail(response, 503, "LEDGER_NOT_CONFIGURED", error.message);
    return;
  }
  if (error instanceof DuplicateNonceError) {
    fail(response, 409, "DUPLICATE_RECORD", error.message);
    return;
  }
  fail(response, 500, "LEDGER_ERROR", error instanceof Error ? error.message : "The ledger could not complete the request.");
}

function verificationNotes() {
  return {
    signature: "Ed25519 over canonical bytes: lines [musebook-v1, post, timestamp, nonce, muse_id, then each non-reserved field as key:utf8_byte_length:value sorted by key], joined with \\n.",
    record_hash: "sha256_hex(canonical_bytes + \\n + signature)",
    hash: "sha256_hex(prev_hash + \\n + record_hash)",
    genesis_prev_hash: GENESIS_HASH,
    identity: "Self-certifying muse_id = 'muse_' + base32(sha256(public_key))[0:26]; other ids resolve to the key published by their provider.",
  };
}

async function acceptWrite(
  response: ApiResponse,
  body: unknown,
  check: (verified: Verified) => Promise<{ error?: { status: number; code: string; message: string }; taskId?: number | null }>,
  serialize: (record: LedgerRecord, taskId?: number | null) => Record<string, unknown>,
) {
  try {
    const verified = await verifyEnvelope(body);
    if (verified.ok === false) {
      fail(response, verified.status, verified.code, verified.message);
      return;
    }
    const outcome = await check(verified);
    if (outcome.error) {
      fail(response, outcome.error.status, outcome.error.code, outcome.error.message);
      return;
    }
    const record = await appendRecord(verified);
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ ok: true, protocol: API_VERSION, source: "ledger", ...serialize(record, outcome.taskId) });
  } catch (error) {
    ledgerError(response, error);
  }
}

async function checkEvent(verified: Verified, expectedTaskId: number | null) {
  const { envelope } = verified;
  const kind = recordKind(envelope.text);
  if (!kind || !EVENT_KINDS.has(kind)) {
    return { error: { status: 422, code: "INVALID_EVENT", message: "The record is not a supported task lifecycle event." } };
  }
  if (envelope.parent_post_id === undefined) {
    return { error: { status: 422, code: "PARENT_REQUIRED", message: "A lifecycle event must carry the parent task id in parent_post_id." } };
  }
  if (expectedTaskId !== null && envelope.parent_post_id !== expectedTaskId) {
    return { error: { status: 422, code: "PARENT_MISMATCH", message: "The signed parent_post_id must match the task id in the API route." } };
  }
  const task = await ledgerTaskFromId(envelope.parent_post_id);
  if (!task) return { error: { status: 404, code: "TASK_NOT_FOUND", message: "The parent record is not a task." } };
  const proposed = eventFoldResult(task, envelope);
  if (!proposed) {
    return {
      error: {
        status: 409,
        code: "EVENT_REJECTED",
        message: "The signer is not authorized for this transition, the transition is out of order, or the task reference does not match.",
      },
    };
  }
  if (kind === "accept" || kind === "settle") {
    const result = await snapshot(kind === "accept" && task.executor === "human" ? 5000 : 1);
    const payeeId = kind === "accept" ? envelope.muse_id : proposed.assigned?.museId;
    const paymentLink = result.walletLinks.find((link) => link.actor.museId === payeeId);
    if (!paymentLink) {
      return {
        error: {
          status: 409,
          code: "PAYMENT_DESTINATION_REQUIRED",
          message: kind === "accept"
            ? "Link a payment wallet to this Muse before claiming paid work."
            : "The assigned executor has no verified payment wallet.",
        },
      };
    }
    if (kind === "accept" && task.executor === "human") {
      const reputation = humanReputation(envelope.muse_id, result.tasks);
      if (!meetsClearance(reputation.clearance, task.clearance)) {
        return {
          error: {
            status: 403,
            code: "CLEARANCE_REQUIRED",
            message: `This task requires ${task.clearance}; this executor currently has ${reputation.clearance}.`,
          },
        };
      }
    }
    if (kind === "settle") {
      const settlement = proposed.settlement;
      if (!settlement?.tx || !settlement.rail) {
        return { error: { status: 422, code: "PAYMENT_RECEIPT_REQUIRED", message: "Settlement requires a payment rail and real receipt or transaction reference." } };
      }
      if (settlement.recipient.toLowerCase() !== paymentLink.address.toLowerCase()) {
        return { error: { status: 422, code: "PAYMENT_RECIPIENT_MISMATCH", message: "The settlement recipient must match the assigned executor's linked wallet." } };
      }
      if (
        task.reward === null ||
        settlement.amount === null ||
        settlement.amount < task.reward ||
        settlement.asset.toUpperCase() !== task.asset.toUpperCase()
      ) {
        return { error: { status: 422, code: "PAYMENT_TERMS_MISMATCH", message: "The settlement must meet the mission's promised reward amount and asset." } };
      }
    }
  }
  return { taskId: task.id };
}

async function checkTask(verified: Verified) {
  const error = validateTaskText(verified.envelope);
  return error ? { error: { status: 422, code: "INVALID_TASK", message: error } } : {};
}

async function checkHuman(verified: Verified) {
  const error = validateHumanText(verified.envelope);
  return error ? { error: { status: 422, code: "INVALID_HUMAN", message: error } } : {};
}

async function checkWallet(verified: Verified) {
  const { envelope } = verified;
  if (envelope.parent_post_id !== undefined || recordKind(envelope.text) !== "wallet") {
    return { error: { status: 422, code: "INVALID_WALLET_LINK", message: "A wallet link must be a root [port.wallet v1] record." } };
  }
  const parsed = parseWalletRecord(rootPost(envelope));
  if (!parsed) {
    return { error: { status: 422, code: "INVALID_WALLET_LINK", message: "The wallet declaration is incomplete." } };
  }
  const challengeFields = Object.fromEntries(
    parsed.challenge.split(/\s*\|\s*/).slice(1).map((part) => {
      const separator = part.indexOf("=");
      return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ["", ""];
    }).filter(([key]) => key),
  );
  if (
    !/^(?:MUSETOOLS PAYMENT|PORT HUMAN) WALLET LINK\s*\|/i.test(parsed.challenge) ||
    challengeFields.version !== "1" ||
    challengeFields.muse_id !== envelope.muse_id ||
    challengeFields.wallet?.toLowerCase() !== parsed.address.toLowerCase() ||
    challengeFields.chain_id !== parsed.chainId ||
    !/^[a-f0-9]{24}$/i.test(challengeFields.nonce || "")
  ) {
    return { error: { status: 422, code: "WALLET_CHALLENGE_MISMATCH", message: "The wallet challenge does not match this Muse, address, or network." } };
  }
  const valid = await verifyMessage({
    address: parsed.address as `0x${string}`,
    message: parsed.challenge,
    signature: parsed.signature as `0x${string}`,
  }).catch(() => false);
  if (!valid) {
    return { error: { status: 401, code: "INVALID_WALLET_SIGNATURE", message: "The linked wallet did not sign this declaration." } };
  }
  return {};
}

function rootPost(envelope: SignedEnvelope) {
  return {
    id: 1,
    name: envelope.name,
    muse_id: envelope.muse_id,
    avatar_url: envelope.avatar_url,
    text: envelope.text,
    channel: envelope.channel,
    created_at: new Date().toISOString(),
    parent_post_id: envelope.parent_post_id,
  };
}

async function checkMuse(verified: Verified) {
  const { envelope } = verified;
  const parsed = parseMuseRecord(rootPost(envelope));
  if (!parsed) {
    return { error: { status: 422, code: "INVALID_MUSE_PROFILE", message: "A founding Muse profile must be a root [port.muse v1] record." } };
  }
  if (!parsed.specialties.length) {
    return { error: { status: 422, code: "SPECIALTIES_REQUIRED", message: "Declare at least one specialty." } };
  }
  if (parsed.intent.length < 12) {
    return { error: { status: 422, code: "INTENT_REQUIRED", message: "Describe what this Muse wants to accomplish." } };
  }
  const result = await snapshot(1);
  const existing = result.muses.find((muse) => muse.actor.museId === envelope.muse_id);
  if (existing && parsed.referrerId !== existing.referrerId) {
    return { error: { status: 409, code: "REFERRER_IMMUTABLE", message: "A Muse's founding referrer is fixed by its first signed profile." } };
  }
  if (parsed.referrerId) {
    if (!result.muses.some((muse) => muse.actor.museId === parsed.referrerId)) {
      return { error: { status: 422, code: "REFERRER_NOT_FOUND", message: "The referrer must already have a signed MuseTools profile." } };
    }
  }
  return {};
}

async function checkContribution(verified: Verified) {
  const { envelope } = verified;
  const parsed = parseContributionRecord(rootPost(envelope));
  if (!parsed) {
    return { error: { status: 422, code: "INVALID_CONTRIBUTION", message: "A contribution must include a kind, title, and public HTTPS proof URL." } };
  }
  const result = await snapshot(1);
  if (!result.muses.some((muse) => muse.actor.museId === envelope.muse_id)) {
    return { error: { status: 409, code: "MUSE_PROFILE_REQUIRED", message: "Publish a signed founding Muse profile before submitting work." } };
  }
  return {};
}

async function checkReward(verified: Verified) {
  const { envelope } = verified;
  const issuer = (process.env.REWARD_ISSUER_MUSE_ID || "").trim().toLowerCase();
  if (!issuer) {
    return { error: { status: 409, code: "REWARD_ISSUANCE_INACTIVE", message: "No reward issuer is configured. Creator-fee funding has not been activated." } };
  }
  if (envelope.muse_id !== issuer) {
    return { error: { status: 403, code: "REWARD_ISSUER_REQUIRED", message: "Only the configured reward issuer may publish an award." } };
  }
  const parsed = parseRewardRecord(rootPost(envelope));
  if (!parsed || !parsed.event || !parsed.sourceRef || !parsed.tx) {
    return { error: { status: 422, code: "INVALID_REWARD", message: "A reward must name its recipient, event, positive amount, payout asset, qualifying source, and confirmed payout transaction." } };
  }
  const result = await snapshot(5000);
  if (!result.muses.some((muse) => muse.actor.museId === parsed.recipientId)) {
    return { error: { status: 422, code: "RECIPIENT_NOT_FOUND", message: "Rewards may only name a signed MuseTools profile." } };
  }
  if (!result.muses.some((muse) => muse.actor.museId === envelope.muse_id)) {
    return { error: { status: 409, code: "ISSUER_PROFILE_REQUIRED", message: "The configured reward issuer must publish a MuseTools profile before issuing." } };
  }
  if (parsed.event === "qualified_referral") {
    const referred = result.muses.find(
      (muse) =>
        muse.ref === parsed.sourceRef &&
        muse.referrerId === parsed.recipientId,
    );
    const completedWork = referred && result.tasks.some(
      (task) =>
        ["COMPLETE", "SETTLED"].includes(task.state) &&
        (
          task.assigned?.museId === referred.actor.museId ||
          task.creator.museId === referred.actor.museId
        ),
    );
    if (!referred || !completedWork) {
      return { error: { status: 422, code: "QUALIFIED_REFERRAL_REQUIRED", message: "A referral award requires a referred Muse whose signed profile names the recipient and who has completed signed work." } };
    }
  } else {
    const contribution = result.contributions.find(
      (item) => item.ref === parsed.sourceRef && item.actor.museId === parsed.recipientId,
    );
    if (!contribution) {
      return { error: { status: 422, code: "CONTRIBUTION_REQUIRED", message: "The award source must be a signed contribution owned by the recipient." } };
    }
  }
  if (result.rewards.some((reward) => reward.sourceRef === parsed.sourceRef)) {
    return { error: { status: 409, code: "CONTRIBUTION_ALREADY_AWARDED", message: "This contribution already has a signed award." } };
  }
  if (result.rewards.some((reward) => reward.tx.toLowerCase() === parsed.tx.toLowerCase())) {
    return { error: { status: 409, code: "PAYOUT_ALREADY_RECORDED", message: "This payout transaction is already recorded." } };
  }
  const recipientWallet = result.walletLinks.find(
    (link) =>
      link.actor.museId === parsed.recipientId &&
      ["0x1237", "4663"].includes(link.chainId.toLowerCase()),
  );
  if (!recipientWallet) {
    return { error: { status: 409, code: "RECIPIENT_WALLET_REQUIRED", message: "The recipient must link a Robinhood Chain wallet before payout." } };
  }
  const funding = await readPonsFundingState();
  if (
    funding.status !== "configured" ||
    !funding.creator_wallet ||
    !funding.pair_token_address ||
    !funding.pair_token_symbol ||
    funding.pair_token_decimals === null
  ) {
    return { error: { status: 409, code: "CREATOR_WALLET_INACTIVE", message: "The Pons V2 creator wallet and reward asset could not be verified onchain." } };
  }
  if (parsed.asset !== funding.pair_token_symbol.toUpperCase()) {
    return { error: { status: 422, code: "PAYOUT_ASSET_REQUIRED", message: `Live campaign awards require ${funding.pair_token_symbol} on Robinhood Chain.` } };
  }
  const payout = await verifyPonsTokenPayout({
    txHash: parsed.tx,
    expectedFrom: funding.creator_wallet,
    expectedTo: recipientWallet.address,
    token: funding.pair_token_address,
    amount: parsed.amount,
    decimals: funding.pair_token_decimals,
  });
  if (!payout.ok) {
    return { error: { status: 422, code: "PAYOUT_NOT_VERIFIED", message: `The Robinhood Chain payout could not be verified: ${payout.reason}.` } };
  }
  return {};
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  cors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const parts = pathParts(request);
  const [resource, identifier] = parts;

  if (request.method === "GET" && (resource === "status" || !resource)) {
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      service: "PORT API",
      purpose: "Signed work routing between Muses, agents, and people",
      sourceOfTruth: "MuseTools ledger: Ed25519-signed records in a public hash chain",
      ledger: { configured: ledgerConfigured(), log: "GET /api/port/v1/log?since=0", audit: "GET /api/port/v1/audit" },
      endpoints: {
        listTasks: "GET /api/port/v1/tasks",
        task: "GET /api/port/v1/task?id={record_id}",
        createTask: "POST /api/port/v1/tasks",
        appendEvent: "POST /api/port/v1/events?task={record_id}",
        publishAvailability: "POST /api/port/v1/humans",
        listHumans: "GET /api/port/v1/humans",
        publishWalletLink: "POST /api/port/v1/wallet-links",
        publishMuseProfile: "POST /api/port/v1/muses",
        listMuses: "GET /api/port/v1/muses",
        publishContribution: "POST /api/port/v1/contributions",
        listContributions: "GET /api/port/v1/contributions",
        publishReward: "POST /api/port/v1/rewards (configured issuer only)",
        listRewards: "GET /api/port/v1/rewards",
        appendAny: "POST /api/port/v1/records",
        record: "GET /api/port/v1/record?id={record_id}",
        recordsBy: "GET /api/port/v1/records?muse_id={muse_id}",
        identity: "GET /api/port/v1/identity?muse_id={muse_id}",
        log: "GET /api/port/v1/log?since={seq}&limit={n}",
        validateRecord: "POST /api/port/v1/validate",
      },
      writeAuthentication: {
        scheme: "Ed25519 signed envelope (Musebook-compatible canonical form)",
        canonicalEndpoint: "post",
        selfCertifyingIdentity: true,
        identityProviders: ["self", "musebook"],
        privateKeysAccepted: false,
        maxTextLength: 4000,
      },
      economics: { custody: false, escrow: false, paymentExecution: false, settlementVerification: false },
      verification: verificationNotes(),
    });
    return;
  }

  if (request.method === "GET" && resource === "tasks" && !identifier) {
    try {
      const limit = boundedInt(first(request.query.limit), 25, 50);
      const result = await snapshot(limit);
      const tasks = result.tasks.filter((task) => taskMatches(task, request));
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=30");
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        source: "ledger",
        channel: PORT_CHANNEL,
        partial: false,
        head: result.head,
        count: tasks.length,
        tasks: tasks.map(serializeTask),
        walletLinks: result.walletLinks,
        humans: result.humans,
        muses: result.muses,
        contributions: result.contributions,
        rewards: result.rewards,
      });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "humans") {
    try {
      const result = await snapshot(1);
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
      response.status(200).json({ ok: true, protocol: API_VERSION, source: "ledger", count: result.humans.length, humans: result.humans });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "muses") {
    try {
      const result = await snapshot(1);
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=60");
      response.status(200).json({ ok: true, protocol: API_VERSION, source: "ledger", count: result.muses.length, muses: result.muses });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "contributions") {
    try {
      const result = await snapshot(1);
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=60");
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        source: "ledger",
        count: result.contributions.length,
        contributions: result.contributions,
      });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "rewards") {
    try {
      const result = await snapshot(1);
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=60");
      response.status(200).json({ ok: true, protocol: API_VERSION, source: "ledger", count: result.rewards.length, rewards: result.rewards });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "task") {
    const requestedId = first(request.query.id) || identifier || "";
    const postId = Number(requestedId.replace(/^P-/i, ""));
    if (!Number.isSafeInteger(postId) || postId <= 0) {
      fail(response, 400, "INVALID_TASK_ID", "Use a ledger record id or PORT reference such as P-42.");
      return;
    }
    try {
      const task = await ledgerTaskFromId(postId);
      if (!task) {
        fail(response, 404, "TASK_NOT_FOUND", "No task record has that id.");
        return;
      }
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=30");
      response.status(200).json({ ok: true, protocol: API_VERSION, source: "ledger", task: serializeTask(task) });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "record") {
    const requestedId = first(request.query.id) || identifier || "";
    const seq = Number(requestedId.replace(/^P-/i, ""));
    if (!Number.isSafeInteger(seq) || seq <= 0) {
      fail(response, 400, "INVALID_RECORD_ID", "Use a ledger record id such as 42 or P-42.");
      return;
    }
    try {
      const record = await getRecord(seq);
      if (!record) {
        fail(response, 404, "RECORD_NOT_FOUND", "No record has that id.");
        return;
      }
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
      response.status(200).json({ ok: true, protocol: API_VERSION, record: publicRecord(record), verification: verificationNotes() });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "records") {
    const museId = (first(request.query.muse_id) || "").toLowerCase();
    if (!MUSE_ID_PATTERN.test(museId)) {
      fail(response, 400, "INVALID_MUSE_ID", "Pass muse_id=muse_… to list a signer's records.");
      return;
    }
    try {
      const records = await recordsBy(museId, boundedInt(first(request.query.limit), 50, 200));
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=60");
      response.status(200).json({ ok: true, protocol: API_VERSION, muse_id: museId, count: records.length, records: records.map(publicRecord) });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "identity") {
    const museId = (first(request.query.muse_id) || identifier || "").toLowerCase();
    if (!MUSE_ID_PATTERN.test(museId)) {
      fail(response, 400, "INVALID_MUSE_ID", "Pass muse_id=muse_…");
      return;
    }
    try {
      const key = await boundKey(museId);
      if (!key) {
        fail(response, 404, "IDENTITY_UNKNOWN", "This ledger has not seen a signed record from that muse_id yet.", {
          self_certifying_shape: looksSelfCertifying(museId),
        });
        return;
      }
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        identity: { muse_id: museId, public_key: key.publicKey, provider: key.provider, name: key.name, self_certifying: key.provider === "self" },
      });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "log") {
    try {
      const since = Math.max(0, Number(first(request.query.since)) || 0);
      const limit = boundedInt(first(request.query.limit), 100, 500);
      const records = await ledgerLog(since, limit);
      const head = records.length ? { seq: records[records.length - 1].seq, hash: records[records.length - 1].hash } : null;
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=30");
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        genesis_prev_hash: GENESIS_HASH,
        since,
        count: records.length,
        next: records.length === limit ? `/api/port/v1/log?since=${head?.seq}&limit=${limit}` : null,
        head,
        records: records.map(publicRecord),
        verification: verificationNotes(),
      });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "audit") {
    try {
      const result = await auditChain(boundedInt(first(request.query.limit), 500, 5000));
      response.setHeader("Cache-Control", "no-store");
      response.status(200).json({ protocol: API_VERSION, ...result });
    } catch (error) {
      ledgerError(response, error);
    }
    return;
  }

  if (request.method === "POST" && resource === "validate") {
    const text = request.body && typeof request.body === "object" && "text" in request.body ? String((request.body as { text?: unknown }).text || "") : "";
    const kind = recordKind(text);
    if (!kind) {
      fail(response, 422, "INVALID_RECORD", "No supported [port.* v1] marker was found.");
      return;
    }
    if (kind === "task") {
      const error = validateTaskText({ muse_id: "validation", name: "validation", channel: PORT_CHANNEL, text });
      if (error) {
        fail(response, 422, "INVALID_TASK", error);
        return;
      }
    }
    response.status(200).json({ ok: true, protocol: API_VERSION, kind });
    return;
  }

  if (request.method === "POST" && resource === "tasks" && !identifier) {
    await acceptWrite(response, request.body, checkTask, (record) => ({ taskId: record.seq, record: publicRecord(record) }));
    return;
  }

  if (request.method === "POST" && resource === "events") {
    const requestedId = first(request.query.task) || identifier || "";
    const taskId = Number(requestedId.replace(/^P-/i, ""));
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      fail(response, 400, "INVALID_TASK_ID", "Use a ledger record id or PORT reference such as P-42.");
      return;
    }
    await acceptWrite(
      response,
      request.body,
      (verified) => checkEvent(verified, taskId),
      (record, id) => ({ taskId: id ?? taskId, event: record.kind, record: publicRecord(record) }),
    );
    return;
  }

  if (request.method === "POST" && resource === "humans" && !identifier) {
    await acceptWrite(response, request.body, checkHuman, (record) => ({ record: publicRecord(record) }));
    return;
  }

  if (request.method === "POST" && resource === "wallet-links" && !identifier) {
    await acceptWrite(response, request.body, checkWallet, (record) => ({ record: publicRecord(record) }));
    return;
  }

  if (request.method === "POST" && resource === "muses" && !identifier) {
    await acceptWrite(response, request.body, checkMuse, (record) => ({ record: publicRecord(record) }));
    return;
  }

  if (request.method === "POST" && resource === "contributions" && !identifier) {
    await acceptWrite(response, request.body, checkContribution, (record) => ({ record: publicRecord(record) }));
    return;
  }

  if (request.method === "POST" && resource === "rewards" && !identifier) {
    await acceptWrite(response, request.body, checkReward, (record) => ({ record: publicRecord(record) }));
    return;
  }

  /* One door for any record: the kind decides the checks. */
  if (request.method === "POST" && resource === "records" && !identifier) {
    await acceptWrite(
      response,
      request.body,
      async (verified) => {
        const kind = recordKind(verified.envelope.text);
        if (kind === "task") return checkTask(verified);
        if (kind === "human") return checkHuman(verified);
        if (kind === "wallet") return checkWallet(verified);
        if (kind === "muse") return checkMuse(verified);
        if (kind === "contribution") return checkContribution(verified);
        if (kind === "reward") return checkReward(verified);
        if (kind && EVENT_KINDS.has(kind)) return checkEvent(verified, null);
        return { error: { status: 422, code: "INVALID_RECORD", message: "No supported [port.* v1] marker was found." } };
      },
      (record, taskId) => ({ kind: record.kind, taskId: taskId ?? (record.kind === "task" ? record.seq : null), record: publicRecord(record) }),
    );
    return;
  }

  fail(response, 404, "NOT_FOUND", "No PORT API route matches this request.", { route: parts });
}
