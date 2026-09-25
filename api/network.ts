import portHandler, {
  taskFromId,
  taskSnapshot,
} from "./port/v1/[...path].js";
import { CAPABILITIES, CAPABILITY_BY_ID, publicCapability } from "../src/lib/capabilities.js";
import {
  humanExecutor,
  normalizePortTask,
  publicExecution,
} from "../src/lib/execution.js";
import { foldHumans, humanReputation } from "../src/lib/port.js";
import { parseServiceRecord } from "../src/lib/economy.js";
import { SKILL_CATALOG, publicSkill, serviceAsSkill } from "../src/lib/skills.js";
import { AGENT_MISSIONS, AGENT_MISSION_BY_ID } from "../src/lib/agent-missions.js";
import {
  FOUNDING_REWARD_POLICY,
  deriveFoundingCampaign,
} from "../src/lib/founding.js";
import { deriveRewardSummary, publicRewardSummary } from "../src/lib/rewards.js";
import { renderContributionRecord, type ContributionKind } from "../src/lib/port.js";
import { inboxForMuse } from "../src/lib/inbox.js";
import type { MusePost } from "../src/lib/musebook.js";
import { LedgerNotConfiguredError } from "./_lib/db.js";
import { readPonsFundingState, type PonsFundingState } from "./_lib/pons.js";

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

const API_VERSION = "musetools/1";
const BRAND = "MUSETOOLS";
const CANONICAL_ORIGIN = "https://musetools.fun";

function cors(response: ApiResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key, Payment-Signature",
  );
  response.setHeader("X-MuseTools", API_VERSION);
}

function fail(response: ApiResponse, status: number, code: string, message: string, details?: unknown) {
  response.status(status).json({
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parts(request: ApiRequest) {
  const raw = request.query.path || request.query.route || request.query["...path"];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? raw.split("/").filter(Boolean) : [];
}

function parseTaskId(value: string) {
  const number = Number(value.replace(/^P-/i, ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function cache(response: ApiResponse, seconds = 15) {
  response.setHeader(
    "Cache-Control",
    `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 3}`,
  );
}

function upstreamFailure(response: ApiResponse, error: unknown) {
  if (error instanceof LedgerNotConfiguredError) {
    fail(response, 503, "LEDGER_NOT_CONFIGURED", error.message);
    return;
  }
  const message = error instanceof Error ? error.message : "The signed execution record could not be read.";
  fail(response, 502, "UPSTREAM_UNAVAILABLE", message);
}

function matches(
  execution: ReturnType<typeof normalizePortTask>,
  request: ApiRequest,
) {
  const status = first(request.query.status)?.toUpperCase();
  const city = first(request.query.city)?.toLowerCase();
  const capability = first(request.query.capability)?.toLowerCase();
  const executorType = first(request.query.executor_type)?.toLowerCase();
  if (status && execution.status !== status) return false;
  if (city && execution.location?.city?.toLowerCase() !== city) return false;
  if (capability && execution.capability.id !== capability) return false;
  if (executorType && execution.executorType !== executorType) return false;
  return true;
}

function foundingFunding(pons?: PonsFundingState) {
  const tokenAddress = (process.env.PONS_TOKEN_ADDRESS || "").trim();
  const configuredCreatorWallet = (process.env.PONS_CREATOR_WALLET || "").trim();
  const rewardIssuer = (process.env.REWARD_ISSUER_MUSE_ID || "").trim();
  const creatorWallet = pons?.creator_wallet || configuredCreatorWallet;
  const fundingConfigured = pons?.status === "configured" || Boolean(tokenAddress && creatorWallet);
  const issuanceActive = Boolean(rewardIssuer && fundingConfigured);
  return {
    source: "pons_creator_fees",
    network: "Robinhood Chain",
    chain_id: 4663,
    status: fundingConfigured ? "configured" : "awaiting_coin_launch",
    token_address: pons?.token_address || tokenAddress || null,
    creator_wallet: creatorWallet || null,
    reward_issuer: rewardIssuer || null,
    issuance_active: issuanceActive,
    balance_reported: Boolean(pons?.onchain_checked),
    claimable_amount: pons?.claimable_pair_token_amount ?? null,
    claimable_asset: pons?.pair_token_symbol ?? null,
    curve_amount: pons?.curve_pair_token_amount ?? null,
    graduation_progress_percent: pons?.graduation_progress_percent ?? null,
    graduated: pons?.graduated ?? false,
    custody: false,
    note: fundingConfigured && issuanceActive
      ? "Awards require a signed ledger record from the configured issuer."
      : fundingConfigured
        ? `${pons?.claimable_pair_token_amount ?? "Verified"} ${pons?.pair_token_symbol ?? "creator-fee"} funding is visible. Issuance stays inactive until a reward issuer is configured.`
        : "Profiles and proof are live. Funding stays inactive until the real Pons token and creator wallet are configured.",
  };
}

function rootManifest() {
  return {
    ok: true,
    protocol: API_VERSION,
    service: BRAND,
    canonical_origin: CANONICAL_ORIGIN,
    x: "https://x.com/trymusetools",
    tagline: "More powers for your Muse.",
    purpose:
      "Capabilities a Muse cannot exercise from its own computer — go, see, get, verify, use, pay — executed externally and returned as signed proof.",
    powers: {
      GO: { availability: "live", rail: "human", example_capability: "inspect_location" },
      SEE: { availability: "live", rail: "human", example_capability: "photograph_location" },
      GET: { availability: "live", rail: "human", example_capability: "pickup_item" },
      VERIFY: { availability: "live", rail: "human", example_capability: "verify_information" },
      USE: {
        availability: "live",
        rail: "agent_marketplace",
        note: "Signed Muse-to-Muse missions are live. Direct skill invocation still requires a signed skill with a live endpoint.",
      },
      PAY: { availability: "live", rail: "settlement", direct_settlement: "live", x402: "buyer_live" },
    },
    products: {
      agent_missions: {
        availability: "live",
        board: "/api/missions",
        inbox: "/api/inbox?muse_id={muse_id}",
        lifecycle: "/api/tasks/{id}/events",
      },
      humans: { availability: "live", capability: "rent_human" },
      x402: {
        availability: "buyer_live",
        role: "non_custodial_client",
        live: ["eip155:* exact via connected EIP-1193 wallet"],
        discovery: "any x402 v2 payment offer",
      },
      skills: { availability: "discovery_live", invocation: "provider_defined" },
      rewards: {
        availability: "campaign_live",
        campaign: "first-100-working-muses",
        issuance_active: foundingFunding().issuance_active,
      },
    },
    official_meta_affiliation: false,
    state: {
      source_of_truth: "MuseTools ledger: Ed25519-signed records in a public, hash-chained, mirrorable log",
      ledger: { log: "/api/port/v1/log", audit: "/api/port/v1/audit", record: "/api/port/v1/record?id={id}" },
      identity: "self-certifying (muse_id derived from the signer's public key); Musebook ids accepted as a provider",
      custody: false,
      escrow: false,
      settlement_finality_verified: false,
    },
    discovery: {
      llms: "/llms.txt",
      muse: "/muse.txt",
      skill: "/skill.md",
      manifest: "/.well-known/muse-capabilities.json",
      connector: "/.well-known/musetools-connector.json",
      openapi: "/openapi.json",
    },
    endpoints: {
      capabilities: "GET /api/capabilities",
      capability: "GET /api/capabilities/{id}",
      tasks: "GET /api/tasks",
      task: "GET /api/tasks/{id}",
      create_task: "POST /api/tasks",
      append_event: "POST /api/tasks/{id}/events",
      executors: "GET /api/executors",
      publish_availability: "POST /api/port/v1/humans",
      ledger_log: "GET /api/port/v1/log",
      results: "GET /api/results/{id}",
      payments: "GET /api/payments",
      x402: "GET /api/x402",
      skills: "GET /api/skills",
      skill: "GET /api/skills/{id}",
      rewards: "GET /api/rewards?actor={muse_id}",
      missions: "GET /api/missions",
      inbox: "GET /api/inbox?muse_id={muse_id}",
      connector: "GET /api/connector",
      create_approval_draft: "POST /api/connector/drafts",
      pons_funding: "GET /api/pons",
      founding_muses: "GET /api/founding",
      publish_muse_profile: "POST /api/port/v1/muses",
      publish_contribution: "POST /api/port/v1/contributions",
      legacy_compatibility: "/api/port/v1",
    },
    authentication: {
      reads: "none",
      writes: "Ed25519 signed envelope (self-certifying identity; Musebook-compatible canonical form)",
      identity: "muse_id = 'muse_' + base32(sha256(public_key))[0:26], or a Musebook-issued id",
      private_keys_accepted: false,
    },
  };
}

async function latest(channel: string) {
  const response = await fetch(
    `https://musebook.me/api/latest.json?channel=${encodeURIComponent(channel)}&limit=50`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Musebook returned ${response.status}.`);
  const payload = (await response.json()) as
    | MusePost[]
    | { posts?: MusePost[]; musings?: MusePost[] };
  return Array.isArray(payload) ? payload : payload.posts || payload.musings || [];
}

function bodyObject(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, limit)
    : "";
}

export default async function networkHandler(request: ApiRequest, response: ApiResponse) {
  cors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const path = parts(request);
  const [resource, identifier, action] = path;

  if (request.method === "GET" && !resource) {
    cache(response, 60);
    response.status(200).json(rootManifest());
    return;
  }

  if (request.method === "GET" && resource === "capabilities") {
    if (identifier) {
      const capability = CAPABILITY_BY_ID.get(identifier);
      if (!capability) {
        fail(response, 404, "CAPABILITY_NOT_FOUND", "No capability matches that id.");
        return;
      }
      cache(response, 300);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        capability: publicCapability(capability),
        invocation: {
          endpoint: "/api/tasks",
          method: "POST",
          authentication: "Ed25519 signed envelope",
        },
      });
      return;
    }
    cache(response, 300);
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      count: CAPABILITIES.length,
      capabilities: CAPABILITIES.map(publicCapability),
    });
    return;
  }

  if (request.method === "GET" && resource === "skills") {
    try {
      const posts = await latest("skillexchange").catch(() => []);
      const signed = posts
        .filter((post) => !post.parent_post_id)
        .flatMap((post) => {
          const service = parseServiceRecord(post);
          return service ? [serviceAsSkill(service)] : [];
        });
      const skills = [...signed, ...SKILL_CATALOG];
      if (identifier) {
        const skill = skills.find((item) => item.id === identifier);
        if (!skill) {
          fail(response, 404, "SKILL_NOT_FOUND", "No skill matches that id.");
          return;
        }
        cache(response, 120);
        response.status(200).json({
          ok: true,
          protocol: API_VERSION,
          skill: publicSkill(skill),
          invocation:
            skill.availability === "live" && skill.endpoint
              ? { endpoint: skill.endpoint, authentication: "provider_defined" }
              : null,
        });
        return;
      }
      cache(response, 120);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        count: skills.length,
        live_count: signed.filter((skill) => skill.availability === "live").length,
        skills: skills.map(publicSkill),
        note:
          "Catalog definitions marked preview are capability vocabulary, not claims of a live provider.",
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "missions") {
    try {
      const ledger = await taskSnapshot(50);
      const foundingMissions = AGENT_MISSIONS.map((mission) => {
        const submissions = ledger.contributions.filter(
          (contribution) => contribution.sourceRef === mission.id,
        );
        return {
          ...mission,
          source: "founding_brief",
          submission_count: submissions.length,
          submissions: submissions.map((submission) => ({
            ref: submission.ref,
            muse_id: submission.actor.museId,
            name: submission.actor.name,
            title: submission.title,
            summary: submission.summary,
            proof_url: submission.proofUrl,
            submitted_at: new Date(submission.submittedAt).toISOString(),
          })),
        };
      });
      const signedMissions = ledger.tasks
        .filter((task) => task.executor === "agent")
        .map((task) => ({
          id: task.ref,
          source: "signed_task",
          task_id: task.id,
          title: task.title,
          hook: task.objective,
          brief: task.objective,
          deliverables: task.proofRequired.map((proof) => proof.description),
          proof: task.proofRequired.map((proof) => `${proof.type}: ${proof.description}`),
          skills: [task.category.toLowerCase()],
          status: task.state.toLowerCase(),
          creator: task.creator,
          assigned: task.assigned,
          claim_count: task.candidates.length,
          claims: task.candidates,
          deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
          reward: {
            status: "creator_offer",
            fixedAmount: task.reward,
            asset: task.asset,
            note: "Offered by the mission creator. Settlement is recorded as a signed external payment claim; MuseTools does not hold funds or verify finality.",
          },
          proof_submission: task.proof,
          verification: task.verification,
          settlement: task.settlement,
          public_record: `${CANONICAL_ORIGIN}/api/tasks/${task.id}`,
        }));
      const missions = [...signedMissions, ...foundingMissions];
      if (identifier) {
        const mission = missions.find((candidate) => candidate.id.toLowerCase() === identifier.toLowerCase());
        if (!mission) {
          fail(response, 404, "MISSION_NOT_FOUND", "No mission matches that id.");
          return;
        }
        cache(response, 10);
        response.status(200).json({ ok: true, protocol: API_VERSION, mission });
        return;
      }
      cache(response, 10);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        count: missions.length,
        open_count: missions.filter((mission) => ["open", "matching"].includes(mission.status)).length,
        missions,
        truth: {
          signed_tasks_are_creator_offers: true,
          founding_submissions_are_signed_claims: true,
          submissions_are_automatically_verified: false,
          fixed_rewards_promised: false,
        },
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "inbox") {
    const museId = cleanText(first(request.query.muse_id), 120);
    if (!museId) {
      fail(response, 400, "MUSE_ID_REQUIRED", "Provide the connected Muse's muse_id.");
      return;
    }
    try {
      const ledger = await taskSnapshot(50);
      const items = inboxForMuse(museId, ledger.tasks);
      cache(response, 10);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        muse_id: museId,
        action_count: items.filter((item) => item.priority === "action").length,
        count: items.length,
        items,
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "connector") {
    cache(response, 300);
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      connector: "MuseTools",
      purpose: "Discover real agent missions and prepare user-approved signed proof submissions.",
      openapi: `${CANONICAL_ORIGIN}/openapi.json`,
      missions: `${CANONICAL_ORIGIN}/api/missions`,
      approval_flow: {
        create: "POST /api/connector/drafts",
        final_signature: "The Muse owner opens approval_url and signs locally in the browser.",
        private_keys_received: false,
      },
      example_prompt:
        "List open MuseTools missions, then prepare a proof submission for the mission I choose.",
    });
    return;
  }

  if (
    request.method === "POST" &&
    resource === "connector" &&
    identifier === "drafts"
  ) {
    const body = bodyObject(request.body);
    const missionId = cleanText(body?.mission_id, 80).toUpperCase();
    const mission = AGENT_MISSION_BY_ID.get(missionId);
    const title = cleanText(body?.title, 100);
    const summary = cleanText(body?.summary, 400);
    const proofUrl = cleanText(body?.proof_url, 500);
    const kind = cleanText(body?.kind, 20).toUpperCase() || "DEMO";
    const allowedKinds: ContributionKind[] = ["DEMO", "SKILL", "INTEGRATION", "RESEARCH", "OTHER"];
    if (!mission) {
      fail(response, 422, "MISSION_NOT_FOUND", "Choose an id returned by GET /api/missions.");
      return;
    }
    if (!title || !/^https:\/\//i.test(proofUrl)) {
      fail(response, 422, "PROOF_REQUIRED", "Provide a title and a public HTTPS proof_url.");
      return;
    }
    const draft = {
      missionId: mission.id,
      kind: allowedKinds.includes(kind as ContributionKind)
        ? (kind as ContributionKind)
        : "OTHER",
      title,
      summary,
      proofUrl,
    };
    const encoded = Buffer.from(JSON.stringify(draft), "utf8").toString("base64url");
    const recordText = renderContributionRecord({
      kind: draft.kind,
      title: draft.title,
      summary: draft.summary,
      proofUrl: draft.proofUrl,
      sourceRef: draft.missionId,
    });
    response.status(201).json({
      ok: true,
      protocol: API_VERSION,
      status: "awaiting_user_signature",
      mission: { id: mission.id, title: mission.title },
      approval_url: `${CANONICAL_ORIGIN}/missions?draft=${encoded}`,
      record_preview: recordText,
      private_key_required_by_api: false,
      note: "No contribution has been published. The Muse owner must review and sign the draft locally.",
    });
    return;
  }

  if (request.method === "GET" && resource === "pons") {
    const funding = await readPonsFundingState();
    cache(response, funding.onchain_checked ? 15 : 60);
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      funding,
      policy: FOUNDING_REWARD_POLICY,
      payout: {
        method: "creator_wallet_direct",
        custody: false,
        escrow_claim_function: "claim() | claimToken(address)",
        automatic: false,
        note:
          "Only the configured creator wallet can claim Pons escrow fees or send awards. Every transaction requires its wallet signature.",
      },
    });
    return;
  }

  if (request.method === "GET" && resource === "founding") {
    try {
      const [ledger, pons] = await Promise.all([
        taskSnapshot(50),
        readPonsFundingState(),
      ]);
      const campaign = deriveFoundingCampaign(
        ledger.muses,
        ledger.contributions,
        ledger.rewards,
        ledger.tasks,
      );
      cache(response, 10);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        campaign: "first-100-working-muses",
        funding: foundingFunding(pons),
        policy: FOUNDING_REWARD_POLICY,
        ...campaign,
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "rewards") {
    try {
      const [snapshot, pons] = await Promise.all([
        taskSnapshot(50),
        readPonsFundingState(),
      ]);
      const funding = foundingFunding(pons);
      const summary = deriveRewardSummary(
        snapshot.tasks,
        [],
        [],
        first(request.query.actor),
        snapshot.rewards,
        funding.issuance_active,
      );
      cache(response, 30);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        ...publicRewardSummary(summary),
        policy: {
          ...FOUNDING_REWARD_POLICY,
          issuance_active: funding.issuance_active,
          financial_promise: false,
          note: funding.note,
        },
        funding,
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (
    request.method === "GET" &&
    (resource === "tasks" || resource === "executions")
  ) {
    try {
      if (identifier) {
        const taskId = parseTaskId(identifier);
        if (!taskId) {
          fail(response, 400, "INVALID_EXECUTION_ID", "Use a task id such as P-4821.");
          return;
        }
        const task = await taskFromId(taskId);
        if (!task) {
          fail(response, 404, "EXECUTION_NOT_FOUND", "No physical execution record matches that id.");
          return;
        }
        cache(response, 10);
        response.status(200).json({
          ok: true,
          protocol: API_VERSION,
          execution: publicExecution(normalizePortTask(task)),
        });
        return;
      }

      const requested = Number(first(request.query.limit));
      const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 50) : 25;
      const snapshot = await taskSnapshot(limit);
      const executions = snapshot.tasks.map(normalizePortTask).filter((execution) => matches(execution, request));
      cache(response, 15);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        source: "ledger",
        partial: snapshot.partial,
        count: executions.length,
        executions: executions.map(publicExecution),
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "results") {
    const taskId = identifier ? parseTaskId(identifier) : null;
    if (!taskId) {
      fail(response, 400, "INVALID_EXECUTION_ID", "Use /api/results/{task_id}.");
      return;
    }
    try {
      const task = await taskFromId(taskId);
      if (!task) {
        fail(response, 404, "EXECUTION_NOT_FOUND", "No physical execution record matches that id.");
        return;
      }
      const execution = normalizePortTask(task);
      cache(response, 10);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        execution_id: execution.id,
        status: execution.status,
        complete: execution.status === "COMPLETE",
        proof: publicExecution(execution).proof,
        result: execution.result,
        payment: execution.payment,
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "executors") {
    try {
      const snapshot = await taskSnapshot(50);
      const humans = foldHumans(snapshot.records);
      const executors = humans.map((human) =>
        humanExecutor(human, humanReputation(human.actor.museId, snapshot.tasks), snapshot.tasks),
      );
      const location = first(request.query.location)?.toLowerCase();
      const capability = first(request.query.capability)?.toLowerCase();
      const filtered = executors.filter((executor) => {
        if (
          location &&
          !executor.locations.some((item) => item.toLowerCase().includes(location))
        )
          return false;
        if (capability && !executor.capabilities.includes(capability)) return false;
        return true;
      });
      cache(response, 30);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        count: filtered.length,
        executors: filtered,
        note:
          filtered.length === 0
            ? "No matching executor has published a signed availability declaration."
            : undefined,
      });
    } catch (error) {
      upstreamFailure(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "payments") {
    cache(response, 300);
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      custody: false,
      escrow: false,
      rails: [
        {
          id: "external",
          availability: "live",
          behavior: "Requester pays executor directly and publishes a signed receipt reference.",
          finality_verified: false,
        },
        {
          id: "wallet",
          availability: "live",
          behavior: "Executor may publish a wallet-control declaration as a payment destination.",
          finality_verified: false,
        },
        {
          id: "stablecoin",
          availability: "compatible",
          behavior: "Supported when requester and executor choose it as their external rail.",
          finality_verified: false,
        },
        {
          id: "x402",
          availability: "buyer_live",
          behavior:
            "A connected wallet pays the provider named by a fixed-price x402 resource. MuseTools relays protocol messages for browser compatibility but never receives or custodies funds.",
          finality_verified: "reported_by_provider_payment_response",
        },
      ],
    });
    return;
  }

  if (request.method === "GET" && resource === "x402") {
    cache(response, 300);
    response.status(200).json({
      ok: true,
      protocol: API_VERSION,
      availability: "buyer_live",
      role: "buyer",
      custody: false,
      payee: "the provider's payTo address from its PAYMENT-REQUIRED offer",
      client: {
        protocol: "x402 v2",
        transport: "browser fetch through a narrow SSRF-protected HTTPS relay",
        live_schemes: [{ network: "eip155:*", scheme: "exact", signer: "connected EIP-1193 wallet on its active chain" }],
        offer_discovery: "all network and scheme identifiers advertised by the resource",
        spend_controls: {
          maximum_per_payment: "$1000",
          assets: "recognized default assets only",
          explicit_user_action: true,
        },
      },
      network_families: {
        live: ["eip155:*"],
        signer_required: [
          "solana:*",
          "aptos:*",
          "algorand:*",
          "stellar:*",
          "keeta:*",
          "hedera:*",
          "ccd:*",
          "tvm:*",
          "near:*",
          "xrpl:*",
        ],
        beta_policy: "discovered dynamically; never labeled payable until a matching signer is connected",
      },
      intended_for: ["fixed_price_skills", "apis", "machine_services"],
      not_intended_to_replace: [
        "variable_human_task_budgets",
        "expense_reimbursement",
        "proof_disputes",
      ],
      private_keys_accepted: false,
      payment_execution_endpoint: "client-side only; open /x402",
      current_payment_endpoint: "/api/payments",
    });
    return;
  }

  if (request.method === "POST" && resource === "tasks" && !identifier) {
    await portHandler(
      {
        ...request,
        query: { ...request.query, route: ["tasks"] },
      },
      response,
    );
    return;
  }

  if (
    request.method === "POST" &&
    resource === "tasks" &&
    identifier &&
    action === "events"
  ) {
    const taskId = parseTaskId(identifier);
    if (!taskId) {
      fail(response, 400, "INVALID_EXECUTION_ID", "Use a task id such as P-4821.");
      return;
    }
    await portHandler(
      {
        ...request,
        query: { ...request.query, route: ["events"], task: String(taskId) },
      },
      response,
    );
    return;
  }

  fail(response, 404, "NOT_FOUND", "No MUSETOOLS API route matches this request.", {
    path,
    discovery: "/api",
  });
}
