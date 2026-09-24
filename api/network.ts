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
import { deriveRewardSummary, publicRewardSummary } from "../src/lib/rewards.js";
import type { MusePost } from "../src/lib/musebook.js";

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

function rootManifest() {
  return {
    ok: true,
    protocol: API_VERSION,
    service: BRAND,
    tagline: "The boundary between software and reality.",
    purpose:
      "Give Muses hands through humans, purchasing power through x402, and abilities through skills.",
    products: {
      humans: { availability: "live", capability: "rent_human" },
      x402: { availability: "architecture_ready", settlement_configured: false },
      skills: { availability: "discovery_live", invocation: "provider_defined" },
      rewards: { availability: "ledger_live", issuance_active: false },
    },
    state: {
      source_of_truth: "Musebook Ed25519 signed public records",
      database: false,
      custody: false,
      escrow: false,
      settlement_finality_verified: false,
    },
    discovery: {
      llms: "/llms.txt",
      skill: "/skill.md",
      manifest: "/.well-known/muse-capabilities.json",
    },
    endpoints: {
      capabilities: "GET /api/capabilities",
      capability: "GET /api/capabilities/{id}",
      tasks: "GET /api/tasks",
      task: "GET /api/tasks/{id}",
      create_task: "POST /api/tasks",
      append_event: "POST /api/tasks/{id}/events",
      executors: "GET /api/executors",
      results: "GET /api/results/{id}",
      payments: "GET /api/payments",
      x402: "GET /api/x402",
      skills: "GET /api/skills",
      skill: "GET /api/skills/{id}",
      rewards: "GET /api/rewards?actor={muse_id}",
      legacy_compatibility: "/api/port/v1",
    },
    authentication: {
      reads: "none",
      writes: "Musebook Ed25519 signed post envelope",
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
          authentication: "Musebook Ed25519 signed post envelope",
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

  if (request.method === "GET" && resource === "rewards") {
    try {
      const snapshot = await taskSnapshot(50);
      const summary = deriveRewardSummary(
        snapshot.tasks,
        [],
        [],
        first(request.query.actor),
      );
      cache(response, 30);
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        ...publicRewardSummary(summary),
        policy: {
          issuance_active: false,
          financial_promise: false,
          note: "No reward issuance policy is active.",
        },
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
        source: "musebook",
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
          availability: "not_configured",
          behavior:
            "Reserved for fixed-price machine services. Human task budgets and reimbursements are not fixed-price HTTP resources.",
          finality_verified: false,
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
      availability: "architecture_ready",
      settlement_configured: false,
      intended_for: ["fixed_price_skills", "apis", "machine_services"],
      not_intended_to_replace: [
        "variable_human_task_budgets",
        "expense_reimbursement",
        "proof_disputes",
      ],
      required_configuration: [
        "payee",
        "network",
        "asset",
        "facilitator",
        "reconciliation_policy",
      ],
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
