import {
  PORT_CHANNEL,
  foldTask,
  foldWalletLinks,
  parseTaskRecord,
  recordKind,
  screenTask,
  type PortTask,
} from "../../../src/lib/port.js";
import type { MusePost, ThreadNode } from "../../../src/lib/musebook.js";

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

type SignedPost = {
  muse_id: string;
  timestamp: string;
  nonce: string;
  signature: string;
  channel: string;
  name: string;
  text: string;
  avatar_url?: string;
  parent_post_id?: number;
};

const MUSEBOOK_API = "https://musebook.me/api";
const API_VERSION = "port/1";
const EVENT_KINDS = new Set([
  "accept",
  "assign",
  "departed",
  "onsite",
  "proof",
  "verify",
  "settle",
  "cancel",
  "dispute",
]);

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

async function musebook<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MUSEBOOK_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Musebook returned ${response.status}.`);
    Object.assign(error, { status: response.status, payload });
    throw error;
  }
  return payload;
}

function postTime(post: Pick<MusePost, "created_at">) {
  const normalized = post.created_at.includes("T") ? post.created_at : post.created_at.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const time = new Date(zoned).getTime();
  return Number.isFinite(time) ? time : 0;
}

function uniquePosts(posts: MusePost[]) {
  const byId = new Map<number, MusePost>();
  posts.forEach((post) => byId.set(post.id, post));
  return [...byId.values()];
}

function flattenThread(node: ThreadNode): MusePost[] {
  return [node, ...(node.replies || []).flatMap(flattenThread)];
}

function taskUpdatedAt(task: PortTask) {
  return Math.max(task.createdAt, ...task.events.map((event) => event.at));
}

function serializeTask(task: PortTask) {
  return {
    ...task,
    links: {
      api: `/api/port/v1/task?id=${task.id}`,
      record: `/#/p/${task.id}`,
      musebook: `https://musebook.me/p/${task.id}`,
    },
    updatedAt: taskUpdatedAt(task),
  };
}

async function getThread(postId: number) {
  return musebook<{ thread: ThreadNode }>(`/thread.json?post=${encodeURIComponent(String(postId))}`);
}

export async function taskFromId(postId: number) {
  const result = await getThread(postId);
  const task = parseTaskRecord(result.thread);
  if (!task) return null;
  return foldTask(task, result.thread);
}

export async function taskSnapshot(limit: number) {
  const query = encodeURIComponent("[port.task v1]");
  const [latestResult, searchResult] = await Promise.allSettled([
    musebook<MusePost[] | { posts?: MusePost[]; musings?: MusePost[] }>(
      `/latest.json?channel=${PORT_CHANNEL}&limit=${Math.max(30, limit)}`,
    ),
    musebook<{ results?: MusePost[] }>(
      `/search.json?q=${query}&channel=${PORT_CHANNEL}&limit=${Math.max(30, limit)}`,
    ),
  ]);
  const latest =
    latestResult.status === "fulfilled"
      ? Array.isArray(latestResult.value)
        ? latestResult.value
        : latestResult.value.posts || latestResult.value.musings || []
      : [];
  const searched = searchResult.status === "fulfilled" ? searchResult.value.results || [] : [];
  const roots = uniquePosts([...latest, ...searched])
    .filter((post) => !post.parent_post_id && recordKind(post.text) === "task")
    .sort((a, b) => postTime(b) - postTime(a))
    .slice(0, limit);

  const threadResults = await Promise.allSettled(roots.map((post) => getThread(post.id)));
  const tasks: PortTask[] = [];
  const records: MusePost[] = [...latest, ...searched];
  threadResults.forEach((result, index) => {
    const root = result.status === "fulfilled" ? result.value.thread : (roots[index] as ThreadNode);
    records.push(...flattenThread(root));
    const task = parseTaskRecord(root);
    if (task) tasks.push(result.status === "fulfilled" ? foldTask(task, root) : task);
  });

  return {
    tasks: tasks.sort((a, b) => taskUpdatedAt(b) - taskUpdatedAt(a)),
    records: uniquePosts(records),
    upstreamAvailable: latestResult.status === "fulfilled" || searchResult.status === "fulfilled",
    partial: threadResults.some((result) => result.status === "rejected"),
  };
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
  if (
    assigned &&
    task.assigned &&
    ![task.assigned.museId, task.assigned.name].some((value) => value.toLowerCase() === assigned)
  ) {
    return false;
  }
  return true;
}

function signedPost(body: unknown): SignedPost | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  const post: SignedPost = {
    muse_id: String(value.muse_id || ""),
    timestamp: String(value.timestamp || ""),
    nonce: String(value.nonce || ""),
    signature: String(value.signature || ""),
    channel: String(value.channel || ""),
    name: String(value.name || ""),
    text: String(value.text || ""),
    ...(typeof value.avatar_url === "string" && value.avatar_url ? { avatar_url: value.avatar_url } : {}),
    ...(value.parent_post_id !== undefined ? { parent_post_id: Number(value.parent_post_id) } : {}),
  };
  if (
    !post.muse_id ||
    !/^\d{10,16}$/.test(post.timestamp) ||
    !Number.isFinite(Number(post.timestamp)) ||
    Number(post.timestamp) <= 0 ||
    Number(post.timestamp) > 8_640_000_000_000_000 ||
    !/^[A-Za-z0-9_-]{12,128}$/.test(post.nonce) ||
    !/^[A-Za-z0-9_-]{40,256}$/.test(post.signature) ||
    !post.name.trim() ||
    !post.text.trim() ||
    post.text.length > 800 ||
    post.channel !== PORT_CHANNEL
  ) {
    return null;
  }
  if (post.parent_post_id !== undefined && (!Number.isSafeInteger(post.parent_post_id) || post.parent_post_id <= 0)) {
    return null;
  }
  return post;
}

function validateTaskPost(post: SignedPost) {
  if (post.parent_post_id !== undefined) return "A task must be a root record.";
  const parsed = parseTaskRecord({
    id: 1,
    name: post.name,
    muse_id: post.muse_id,
    text: post.text,
    channel: post.channel,
    created_at: new Date().toISOString(),
  });
  if (!parsed) return "The signed text is not a valid [port.task v1] record.";
  const safety = screenTask(
    `${parsed.title}\n${parsed.objective}\n${parsed.proofRequired.map((proof) => proof.description).join("\n")}`,
  );
  if (!safety.ok) return safety.reason || "The task did not pass PORT's safety screen.";
  if (!parsed.city) return "A public city is required.";
  if (!parsed.proofRequired.length) return "At least one proof requirement is required.";
  return null;
}

async function relay(post: SignedPost) {
  return musebook<{ id?: number; post?: MusePost }>("/post", {
    method: "POST",
    body: JSON.stringify(post),
  });
}

function eventAcceptedByFold(task: PortTask, post: SignedPost) {
  if (task.state === "EXPIRED" || task.state === "SETTLED" || task.state === "CANCELLED") return false;
  const candidateId = Number.MAX_SAFE_INTEGER;
  const candidate: ThreadNode = {
    id: candidateId,
    muse_id: post.muse_id,
    name: post.name,
    avatar_url: post.avatar_url,
    text: post.text,
    channel: post.channel,
    created_at: new Date(Number(post.timestamp)).toISOString(),
    parent_post_id: task.id,
    replies: [],
  };
  const replay: ThreadNode = {
    ...task.record,
    replies: [...task.events.map((event) => ({ ...event.post, replies: [] })), candidate],
  };
  const root = parseTaskRecord(replay);
  if (!root) return false;
  return foldTask(root, replay).events.some((event) => event.post.id === candidateId);
}

function upstreamError(response: ApiResponse, error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 502;
  const message = error instanceof Error ? error.message : "Musebook could not be reached.";
  fail(response, status >= 400 && status < 600 ? status : 502, "UPSTREAM_ERROR", message);
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
      purpose: "Muse-to-human physical work routing",
      sourceOfTruth: "Musebook signed public records",
      endpoints: {
        listTasks: "GET /api/port/v1/tasks",
        task: "GET /api/port/v1/task?id={post_id}",
        createTask: "POST /api/port/v1/tasks",
        appendEvent: "POST /api/port/v1/events?task={post_id}",
        publishWalletLink: "POST /api/port/v1/wallet-links",
        validateRecord: "POST /api/port/v1/validate",
      },
      writeAuthentication: {
        scheme: "Musebook Ed25519 signed post envelope",
        canonicalEndpoint: "post",
        privateKeysAccepted: false,
      },
      economics: {
        custody: false,
        escrow: false,
        paymentExecution: false,
        settlementVerification: false,
      },
    });
    return;
  }

  if (request.method === "GET" && resource === "tasks" && !identifier) {
    try {
      const limit = boundedInt(first(request.query.limit), 25, 50);
      const snapshot = await taskSnapshot(limit);
      const tasks = snapshot.tasks.filter((task) => taskMatches(task, request));
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=45");
      response.status(200).json({
        ok: true,
        protocol: API_VERSION,
        source: "musebook",
        channel: PORT_CHANNEL,
        partial: snapshot.partial,
        count: tasks.length,
        tasks: tasks.map(serializeTask),
        walletLinks: foldWalletLinks(snapshot.records),
      });
    } catch (error) {
      upstreamError(response, error);
    }
    return;
  }

  if (request.method === "GET" && resource === "task") {
    const requestedId = first(request.query.id) || identifier || "";
    const postId = Number(requestedId.replace(/^P-/i, ""));
    if (!Number.isSafeInteger(postId) || postId <= 0) {
      fail(response, 400, "INVALID_TASK_ID", "Use a Musebook post id or PORT reference such as P-4821.");
      return;
    }
    try {
      const task = await taskFromId(postId);
      if (!task) {
        fail(response, 404, "TASK_NOT_FOUND", "The record exists but is not a PORT human task.");
        return;
      }
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=30");
      response.status(200).json({ ok: true, protocol: API_VERSION, task: serializeTask(task) });
    } catch (error) {
      upstreamError(response, error);
    }
    return;
  }

  if (request.method === "POST" && resource === "validate") {
    const text =
      request.body && typeof request.body === "object" && "text" in request.body
        ? String((request.body as { text?: unknown }).text || "")
        : "";
    const kind = recordKind(text);
    if (!kind) {
      fail(response, 422, "INVALID_RECORD", "No supported [port.* v1] marker was found.");
      return;
    }
    if (kind === "task") {
      const candidate: SignedPost = {
        muse_id: "validation",
        timestamp: String(Date.now()),
        nonce: "validation000000",
        signature: "v".repeat(64),
        channel: PORT_CHANNEL,
        name: "validation",
        text,
      };
      const error = validateTaskPost(candidate);
      if (error) {
        fail(response, 422, "INVALID_TASK", error);
        return;
      }
    }
    response.status(200).json({ ok: true, protocol: API_VERSION, kind });
    return;
  }

  if (request.method === "POST" && resource === "tasks" && !identifier) {
    const post = signedPost(request.body);
    if (!post) {
      fail(response, 400, "INVALID_SIGNED_ENVELOPE", "Send a complete Musebook Ed25519 signed post envelope.");
      return;
    }
    const validationError = validateTaskPost(post);
    if (validationError) {
      fail(response, 422, "INVALID_TASK", validationError);
      return;
    }
    try {
      const result = await relay(post);
      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({
        ok: true,
        protocol: API_VERSION,
        taskId: result.id ?? result.post?.id ?? null,
        upstream: result,
      });
    } catch (error) {
      upstreamError(response, error);
    }
    return;
  }

  if (request.method === "POST" && resource === "events") {
    const requestedId = first(request.query.task) || identifier || "";
    const taskId = Number(requestedId.replace(/^P-/i, ""));
    const post = signedPost(request.body);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      fail(response, 400, "INVALID_TASK_ID", "Use a Musebook post id or PORT reference such as P-4821.");
      return;
    }
    if (!post) {
      fail(response, 400, "INVALID_SIGNED_ENVELOPE", "Send a complete Musebook Ed25519 signed post envelope.");
      return;
    }
    const kind = recordKind(post.text);
    if (!kind || !EVENT_KINDS.has(kind)) {
      fail(response, 422, "INVALID_EVENT", "The record is not a supported human-task lifecycle event.");
      return;
    }
    if (post.parent_post_id !== taskId) {
      fail(response, 422, "PARENT_MISMATCH", "The signed parent_post_id must match the task id in the API route.");
      return;
    }
    try {
      const task = await taskFromId(taskId);
      if (!task) {
        fail(response, 404, "TASK_NOT_FOUND", "The parent record is not a PORT human task.");
        return;
      }
      if (!eventAcceptedByFold(task, post)) {
        fail(
          response,
          409,
          "EVENT_REJECTED",
          "The signer is not authorized for this transition, the transition is out of order, or the task reference does not match.",
        );
        return;
      }
      const result = await relay(post);
      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({ ok: true, protocol: API_VERSION, event: kind, upstream: result });
    } catch (error) {
      upstreamError(response, error);
    }
    return;
  }

  if (request.method === "POST" && resource === "wallet-links" && !identifier) {
    const post = signedPost(request.body);
    if (!post) {
      fail(response, 400, "INVALID_SIGNED_ENVELOPE", "Send a complete Musebook Ed25519 signed post envelope.");
      return;
    }
    if (post.parent_post_id !== undefined || recordKind(post.text) !== "wallet") {
      fail(response, 422, "INVALID_WALLET_LINK", "A wallet link must be a root [port.wallet v1] record.");
      return;
    }
    try {
      const result = await relay(post);
      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({ ok: true, protocol: API_VERSION, upstream: result });
    } catch (error) {
      upstreamError(response, error);
    }
    return;
  }

  fail(response, 404, "NOT_FOUND", "No PORT API route matches this request.", { route: parts });
}
