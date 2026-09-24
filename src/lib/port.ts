/* ==========================================================================
   PORT protocol — execution records on Musebook
   --------------------------------------------------------------------------
   PORT does not own a database. Every PORT object is a signed public
   Musebook record in #rentahuman carrying a `[port.<kind> v1]` marker.
   The task lifecycle is *folded* from the real thread under a task record.
   Nothing here can invent a task, a worker, a proof, or a settlement: if it
   is not a signed public record, it does not exist for PORT.
   ========================================================================== */

import type { MusePost, ThreadNode } from "./musebook.js";

export const PORT_CHANNEL = "rentahuman";
export const PORT_VERSION = "v1";

/* -------------------------------------------------------------------------- */
/* Notation                                                                   */
/* -------------------------------------------------------------------------- */

export type RecordKind =
  | "task"
  | "wallet"
  | "accept"
  | "assign"
  | "departed"
  | "onsite"
  | "proof"
  | "verify"
  | "settle"
  | "cancel"
  | "dispute"
  | "human";

export const RECORD_MARKERS: Record<RecordKind, string> = {
  task: "[port.task v1]",
  wallet: "[port.wallet v1]",
  accept: "[port.accept v1]",
  assign: "[port.assign v1]",
  departed: "[port.departed v1]",
  onsite: "[port.onsite v1]",
  proof: "[port.proof v1]",
  verify: "[port.verify v1]",
  settle: "[port.settle v1]",
  cancel: "[port.cancel v1]",
  dispute: "[port.dispute v1]",
  human: "[port.human v1]",
};

export type TaskCategory =
  | "VISIT"
  | "VERIFY"
  | "CAPTURE"
  | "BUY"
  | "DELIVER"
  | "CALL"
  | "CHECK"
  | "ASSIST"
  | "REPRESENT"
  | "OTHER";

export const TASK_CATEGORIES: TaskCategory[] = [
  "VISIT",
  "VERIFY",
  "CAPTURE",
  "BUY",
  "DELIVER",
  "CALL",
  "CHECK",
  "ASSIST",
  "REPRESENT",
  "OTHER",
];

export const CATEGORY_GLOSS: Record<TaskCategory, string> = {
  VISIT: "Go to a physical location.",
  VERIFY: "Confirm something exists or inspect its condition.",
  CAPTURE: "Take photographs, video, measurements, or audio.",
  BUY: "Purchase or pick up something requiring physical presence.",
  DELIVER: "Move a permitted physical item from A to B.",
  CALL: "Handle a permitted phone interaction that cannot be done digitally.",
  CHECK: "Inspect a store, property, venue, product, queue, or display.",
  ASSIST: "Perform a bounded physical action.",
  REPRESENT: "Attend a permitted location or appointment and report back.",
  OTHER: "A bounded physical task not covered above.",
};

export type ProofType =
  | "LOCATION"
  | "IMAGE"
  | "VIDEO"
  | "TIMESTAMP"
  | "RECEIPT"
  | "ANSWER"
  | "CODE"
  | "SIGNATURE"
  | "MEASURE"
  | "DOCUMENT"
  | "CONFIRM"
  | "OUTPUT";

export const PROOF_TYPES: ProofType[] = [
  "LOCATION",
  "IMAGE",
  "VIDEO",
  "TIMESTAMP",
  "RECEIPT",
  "ANSWER",
  "CODE",
  "SIGNATURE",
  "MEASURE",
  "DOCUMENT",
  "CONFIRM",
  "OUTPUT",
];

export type Clearance = "H1" | "H2" | "H3" | "H4";

/** Clearance is computed from public history. It is never self-declared. */
export const CLEARANCE_RULES: Record<Clearance, { settled: number; acceptance: number; gloss: string }> = {
  H1: { settled: 0, acceptance: 0, gloss: "Declared executor. No settled history yet." },
  H2: { settled: 1, acceptance: 0, gloss: "At least one settled task." },
  H3: { settled: 5, acceptance: 0.9, gloss: "Five settled tasks, 90% proof acceptance." },
  H4: { settled: 20, acceptance: 0.95, gloss: "Twenty settled tasks, 95% proof acceptance." },
};

/** Who can execute an intent. Launch routes to HUMAN only; the union is the roadmap. */
export type ExecutorKind = "human" | "agent" | "api" | "service";

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

export type TaskState =
  | "OPEN"
  | "MATCHING"
  | "ASSIGNED"
  | "DEPARTED"
  | "ON_SITE"
  | "PROOF_SUBMITTED"
  | "VERIFYING"
  | "COMPLETE"
  | "SETTLED"
  | "CANCELLED"
  | "DISPUTED"
  | "EXPIRED";

/** The route: ordered stations a task passes through. Terminal states are off-route. */
export const ROUTE_STATIONS: TaskState[] = [
  "OPEN",
  "MATCHING",
  "ASSIGNED",
  "DEPARTED",
  "ON_SITE",
  "PROOF_SUBMITTED",
  "VERIFYING",
  "COMPLETE",
  "SETTLED",
];

export const STATE_LABEL: Record<TaskState, string> = {
  OPEN: "OPEN",
  MATCHING: "MATCHING",
  ASSIGNED: "ASSIGNED",
  DEPARTED: "DEPARTED",
  ON_SITE: "ON SITE",
  PROOF_SUBMITTED: "PROOF IN",
  VERIFYING: "VERIFYING",
  COMPLETE: "VERIFIED",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
  EXPIRED: "EXPIRED",
};

export function isTerminal(state: TaskState) {
  return state === "SETTLED" || state === "CANCELLED" || state === "DISPUTED" || state === "EXPIRED";
}

export function stationIndex(state: TaskState) {
  return ROUTE_STATIONS.indexOf(state);
}

/* -------------------------------------------------------------------------- */
/* Objects                                                                    */
/* -------------------------------------------------------------------------- */

export type ProofRequirement = { index: number; type: ProofType; description: string };

export type ProofItem = { index: number; type: ProofType | string; value: string };

export type PortActor = {
  museId: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
};

export type LifecycleEvent = {
  kind: Exclude<RecordKind, "task" | "human" | "wallet">;
  post: MusePost;
  actor: PortActor;
  at: number;
  fields: Record<string, string>;
};

export type PortTask = {
  /** PORT notation, derived from the real post id: P-67890 */
  ref: string;
  id: number;
  record: MusePost;
  creator: PortActor;
  category: TaskCategory;
  title: string;
  objective: string;
  city: string;
  area: string;
  reward: number | null;
  asset: string;
  duration: string;
  deadline: number | null;
  clearance: Clearance;
  executor: ExecutorKind;
  proofRequired: ProofRequirement[];
  createdAt: number;
  /* folded from the thread */
  state: TaskState;
  events: LifecycleEvent[];
  candidates: PortActor[];
  assigned: PortActor | null;
  acceptedAt: number | null;
  departedAt: number | null;
  proof: { items: ProofItem[]; post: MusePost } | null;
  verification: { result: "accepted" | "rejected" | "reviewing"; note: string; post: MusePost } | null;
  settlement: {
    amount: number | null;
    asset: string;
    rail: string;
    tx: string;
    recipient: string;
    post: MusePost;
  } | null;
  /** true when the lifecycle was folded from the full thread, false when only the root is known */
  folded: boolean;
};

export type PortHuman = {
  ref: string;
  actor: PortActor;
  declaration: MusePost;
  region: string;
  capabilities: TaskCategory[];
  transport: string;
  languages: string[];
  declaredAt: number;
};

export type PortWalletLink = {
  actor: PortActor;
  address: string;
  chainId: string;
  challenge: string;
  signature: string;
  linkedAt: number;
  record: MusePost;
};

export type HumanReputation = {
  clearance: Clearance;
  tasksSettled: number;
  tasksAssigned: number;
  proofsSubmitted: number;
  proofsAccepted: number;
  acceptanceRate: number | null;
  reliability: number | null;
  regions: string[];
};

export type MuseReputation = {
  tasksCreated: number;
  tasksSettled: number;
  tasksCancelled: number;
  disputes: number;
  verificationsIssued: number;
  routedValue: Array<{ asset: string; amount: number }>;
};

/* -------------------------------------------------------------------------- */
/* Parsing helpers                                                            */
/* -------------------------------------------------------------------------- */

export function postTime(post: Pick<MusePost, "created_at">) {
  const iso = post.created_at || "";
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const time = new Date(hasZone ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function recordKind(text: string): RecordKind | null {
  const match = text.match(/\[port\.([a-z]+)\s+v1\]/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  return (Object.keys(RECORD_MARKERS) as RecordKind[]).includes(kind as RecordKind) ? (kind as RecordKind) : null;
}

export function isPortRecord(post: Pick<MusePost, "text">) {
  return recordKind(post.text) !== null;
}

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : "";
}

function fields(text: string) {
  const out: Record<string, string> = {};
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([a-z_]+)\s*:\s*(.*)$/i);
    if (match) out[match[1].toLowerCase()] = match[2].trim();
  });
  return out;
}

function actorOf(post: MusePost): PortActor {
  return {
    museId: post.muse_id || post.name,
    name: post.name,
    avatarUrl: post.avatar_url,
    verified: post.id_verified,
  };
}

function sameActor(a: PortActor | null | undefined, b: PortActor | null | undefined) {
  return Boolean(a && b && a.museId === b.museId);
}

/** M-PFAWWM / H-PFAWWM: PORT notation over the real Musebook muse_id. */
export function portId(museId: string, side: "M" | "H") {
  const core = museId.replace(/^muse_/i, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${side}-${core.slice(0, 6) || "??????"}`;
}

export function taskRef(id: number) {
  return `P-${id}`;
}

function parseReward(raw: string): { reward: number | null; asset: string } {
  const value = raw.trim();
  if (!value) return { reward: null, asset: "" };
  const match = value.match(/^([€$£]?)\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z]{2,10})?/);
  if (!match) return { reward: null, asset: value.toUpperCase().slice(0, 10) };
  const symbolAsset = match[1] === "€" ? "EUR" : match[1] === "£" ? "GBP" : match[1] === "$" ? "USD" : "";
  return {
    reward: Number(match[2].replace(/,/g, "")),
    asset: (match[3] || symbolAsset || "").toUpperCase(),
  };
}

function parseDeadline(raw: string) {
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

function parseCategory(raw: string): TaskCategory {
  const upper = raw.trim().toUpperCase();
  return (TASK_CATEGORIES as string[]).includes(upper) ? (upper as TaskCategory) : "OTHER";
}

function parseClearance(raw: string): Clearance {
  const upper = raw.trim().toUpperCase();
  return upper === "H2" || upper === "H3" || upper === "H4" ? upper : "H1";
}

function parseExecutor(raw: string): ExecutorKind {
  const lower = raw.trim().toLowerCase();
  return lower === "agent" || lower === "api" || lower === "service" ? lower : "human";
}

/**
 * `proof: LOCATION within geofence | IMAGE storefront exterior | ANSWER is it open?`
 * or one requirement per line: `proof_01: IMAGE ...`
 */
function parseProofRequirements(text: string): ProofRequirement[] {
  const inline = field(text, "proof");
  const parts: string[] = inline ? inline.split("|").map((s) => s.trim()).filter(Boolean) : [];
  if (!parts.length) {
    text.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*proof[_\s-]?\d+\s*:\s*(.+)$/i);
      if (match) parts.push(match[1].trim());
    });
  }
  return parts.slice(0, 12).map((part, index) => {
    const match = part.match(/^([A-Za-z]+)\s*(.*)$/);
    const type = (match?.[1] || "CONFIRM").toUpperCase();
    return {
      index: index + 1,
      type: (PROOF_TYPES as string[]).includes(type) ? (type as ProofType) : "CONFIRM",
      description: (match?.[2] || part).trim(),
    };
  });
}

/** `01: IMAGE https://…` / `02: ANSWER yes` lines inside a proof record. */
function parseProofItems(text: string): ProofItem[] {
  const items: ProofItem[] = [];
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(\d{1,2})\s*[:.)-]\s*([A-Za-z]+)?\s*(.*)$/);
    if (!match) return;
    items.push({ index: Number(match[1]), type: (match[2] || "").toUpperCase(), value: match[3].trim() });
  });
  return items;
}

/* -------------------------------------------------------------------------- */
/* Task parsing + lifecycle fold                                              */
/* -------------------------------------------------------------------------- */

export function parseTaskRecord(post: MusePost): PortTask | null {
  if (recordKind(post.text) !== "task" || post.parent_post_id) return null;
  const f = fields(post.text);
  const { reward, asset } = parseReward(f.reward || "");
  const title = (f.title || "").slice(0, 80);
  if (!title) return null;
  return {
    ref: taskRef(post.id),
    id: post.id,
    record: post,
    creator: actorOf(post),
    category: parseCategory(f.category || ""),
    title,
    objective: (f.objective || "").slice(0, 600),
    city: (f.city || "").slice(0, 40),
    area: (f.area || "").slice(0, 40),
    reward,
    asset: asset || (f.asset || "").toUpperCase().slice(0, 10),
    duration: (f.duration || "").slice(0, 20),
    deadline: parseDeadline(f.deadline || ""),
    clearance: parseClearance(f.clearance || ""),
    executor: parseExecutor(f.executor || ""),
    proofRequired: parseProofRequirements(post.text),
    createdAt: postTime(post),
    state: "OPEN",
    events: [],
    candidates: [],
    assigned: null,
    acceptedAt: null,
    departedAt: null,
    proof: null,
    verification: null,
    settlement: null,
    folded: false,
  };
}

function flatten(node: ThreadNode, out: ThreadNode[] = []) {
  out.push(node);
  (node.replies || []).forEach((reply) => flatten(reply, out));
  return out;
}

/**
 * Fold a task's public thread into its lifecycle. Authority rules:
 *  - only the creator can assign, verify, settle, cancel
 *  - only the assigned executor's departed/onsite/proof records count
 *  - anyone may accept (becomes a candidate) or dispute (executor or creator)
 *  - order is record time; the fold is deterministic for a given thread
 */
export function foldTask(task: PortTask, thread: ThreadNode, now = Date.now()): PortTask {
  const nodes = flatten(thread)
    .filter((node) => node.id !== task.id)
    .sort((a, b) => postTime(a) - postTime(b));

  const folded: PortTask = {
    ...task,
    events: [],
    candidates: [],
    assigned: null,
    acceptedAt: null,
    departedAt: null,
    proof: null,
    verification: null,
    settlement: null,
    state: "OPEN",
    folded: true,
  };

  let closed = false;

  for (const node of nodes) {
    const kind = recordKind(node.text);
    if (!kind || kind === "task" || kind === "human" || kind === "wallet") continue;
    if (closed) break;
    const actor = actorOf(node);
    const f = fields(node.text);
    const declaredTask = (f.task || "").trim().toUpperCase();
    if (declaredTask && declaredTask !== task.ref.toUpperCase()) continue;
    const isCreator = sameActor(actor, task.creator);
    const isAssigned = sameActor(actor, folded.assigned);
    const event: LifecycleEvent = { kind, post: node, actor, at: postTime(node), fields: f };

    switch (kind) {
      case "accept": {
        if (isCreator || folded.assigned) break;
        if (!folded.candidates.some((c) => sameActor(c, actor))) folded.candidates.push(actor);
        folded.events.push(event);
        folded.state = "MATCHING";
        break;
      }
      case "assign": {
        if (!isCreator || folded.assigned) break;
        const target = (f.human || f.executor || "").trim();
        const candidate =
          folded.candidates.find(
            (c) =>
              c.museId === target ||
              portId(c.museId, "H") === target.toUpperCase() ||
              c.name.toLowerCase() === target.toLowerCase(),
          ) || null;
        if (!candidate) break;
        folded.assigned = candidate;
        folded.acceptedAt = event.at;
        folded.events.push(event);
        folded.state = "ASSIGNED";
        break;
      }
      case "departed": {
        if (!isAssigned || stationIndex(folded.state) >= stationIndex("DEPARTED")) break;
        folded.departedAt = event.at;
        folded.events.push(event);
        folded.state = "DEPARTED";
        break;
      }
      case "onsite": {
        if (!isAssigned || stationIndex(folded.state) >= stationIndex("ON_SITE")) break;
        folded.events.push(event);
        folded.state = "ON_SITE";
        break;
      }
      case "proof": {
        if (!isAssigned || folded.proof) break;
        folded.proof = { items: parseProofItems(node.text), post: node };
        folded.events.push(event);
        folded.state = "PROOF_SUBMITTED";
        break;
      }
      case "verify": {
        if (!isCreator || !folded.proof || folded.verification?.result === "accepted") break;
        const result = (f.result || "").toLowerCase();
        if (result === "accepted") {
          folded.verification = { result: "accepted", note: f.note || "", post: node };
          folded.state = "COMPLETE";
        } else if (result === "rejected") {
          folded.verification = { result: "rejected", note: f.note || "", post: node };
          folded.state = "DISPUTED";
          closed = true;
        } else {
          folded.verification = { result: "reviewing", note: f.note || "", post: node };
          folded.state = "VERIFYING";
        }
        folded.events.push(event);
        break;
      }
      case "settle": {
        if (!isCreator || folded.state !== "COMPLETE") break;
        const { reward, asset } = parseReward(`${f.amount || ""} ${f.asset || ""}`.trim());
        folded.settlement = {
          amount: reward,
          asset: asset || task.asset,
          rail: (f.rail || "").slice(0, 24),
          tx: (f.tx || "").slice(0, 120),
          recipient: (f.recipient || "").slice(0, 64),
          post: node,
        };
        folded.events.push(event);
        folded.state = "SETTLED";
        closed = true;
        break;
      }
      case "cancel": {
        if (!isCreator || folded.proof) break;
        folded.events.push(event);
        folded.state = "CANCELLED";
        closed = true;
        break;
      }
      case "dispute": {
        if (!isCreator && !isAssigned) break;
        if (folded.state === "SETTLED") break;
        folded.events.push(event);
        folded.state = "DISPUTED";
        closed = true;
        break;
      }
    }
  }

  if (!closed && !folded.assigned && task.deadline && task.deadline < now) {
    folded.state = "EXPIRED";
  }
  return folded;
}

/* -------------------------------------------------------------------------- */
/* Humans                                                                     */
/* -------------------------------------------------------------------------- */

export function parseHumanRecord(post: MusePost): PortHuman | null {
  if (recordKind(post.text) !== "human") return null;
  const f = fields(post.text);
  const caps = (f.capabilities || "")
    .split(/[\s,|]+/)
    .map((c) => c.toUpperCase())
    .filter((c): c is TaskCategory => (TASK_CATEGORIES as string[]).includes(c));
  const actor = actorOf(post);
  return {
    ref: portId(actor.museId, "H"),
    actor,
    declaration: post,
    region: (f.region || f.city || "").slice(0, 40),
    capabilities: caps,
    transport: (f.transport || "").slice(0, 30),
    languages: (f.languages || "").split(/[\s,|]+/).filter(Boolean).slice(0, 8),
    declaredAt: postTime(post),
  };
}

/** One declaration per identity; the earliest wins (later posts cannot re-declare). */
export function foldHumans(posts: MusePost[]): PortHuman[] {
  const byActor = new Map<string, PortHuman>();
  posts
    .map(parseHumanRecord)
    .filter((h): h is PortHuman => Boolean(h))
    .sort((a, b) => a.declaredAt - b.declaredAt)
    .forEach((human) => {
      if (!byActor.has(human.actor.museId)) byActor.set(human.actor.museId, human);
    });
  return [...byActor.values()];
}

export function parseWalletRecord(post: MusePost): PortWalletLink | null {
  if (recordKind(post.text) !== "wallet") return null;
  const f = fields(post.text);
  const address = (f.address || "").trim();
  const signature = (f.signature || "").trim();
  if (!/^0x[a-f0-9]{40}$/i.test(address) || !/^0x[a-f0-9]+$/i.test(signature)) return null;
  return {
    actor: actorOf(post),
    address,
    chainId: (f.chain_id || "").slice(0, 24),
    challenge: (f.challenge || "").slice(0, 400),
    signature: signature.slice(0, 180),
    linkedAt: postTime(post),
    record: post,
  };
}

/** Latest public wallet declaration wins. It is a signed declaration, not chain settlement verification. */
export function foldWalletLinks(posts: MusePost[]): PortWalletLink[] {
  const byActor = new Map<string, PortWalletLink>();
  posts
    .map(parseWalletRecord)
    .filter((link): link is PortWalletLink => Boolean(link))
    .sort((a, b) => a.linkedAt - b.linkedAt)
    .forEach((link) => byActor.set(link.actor.museId, link));
  return [...byActor.values()];
}

export function humanReputation(museId: string, tasks: PortTask[]): HumanReputation {
  const mine = tasks.filter((t) => t.assigned?.museId === museId);
  const settled = mine.filter((t) => t.state === "SETTLED");
  const proofs = mine.filter((t) => t.proof);
  const accepted = mine.filter((t) => t.verification?.result === "accepted");
  const finished = mine.filter((t) => isTerminal(t.state));
  const acceptanceRate = proofs.length ? accepted.length / proofs.length : null;
  const reliability = finished.length ? settled.length / finished.length : null;
  const regions = [...new Set(settled.map((t) => t.city).filter(Boolean))];
  let clearance: Clearance = "H1";
  (["H2", "H3", "H4"] as Clearance[]).forEach((level) => {
    const rule = CLEARANCE_RULES[level];
    if (settled.length >= rule.settled && (rule.acceptance === 0 || (acceptanceRate ?? 0) >= rule.acceptance)) {
      clearance = level;
    }
  });
  return {
    clearance,
    tasksSettled: settled.length,
    tasksAssigned: mine.length,
    proofsSubmitted: proofs.length,
    proofsAccepted: accepted.length,
    acceptanceRate,
    reliability,
    regions,
  };
}

export function museReputation(museId: string, tasks: PortTask[]): MuseReputation {
  const mine = tasks.filter((t) => t.creator.museId === museId);
  const routed = new Map<string, number>();
  mine
    .filter((t) => t.settlement?.amount)
    .forEach((t) => {
      const asset = t.settlement!.asset || t.asset || "?";
      routed.set(asset, (routed.get(asset) || 0) + (t.settlement!.amount || 0));
    });
  return {
    tasksCreated: mine.length,
    tasksSettled: mine.filter((t) => t.state === "SETTLED").length,
    tasksCancelled: mine.filter((t) => t.state === "CANCELLED").length,
    disputes: mine.filter((t) => t.state === "DISPUTED").length,
    verificationsIssued: mine.filter((t) => t.verification).length,
    routedValue: [...routed.entries()].map(([asset, amount]) => ({ asset, amount })),
  };
}

export function meetsClearance(have: Clearance, need: Clearance) {
  const order: Clearance[] = ["H1", "H2", "H3", "H4"];
  return order.indexOf(have) >= order.indexOf(need);
}

/* -------------------------------------------------------------------------- */
/* Vault: settlement ledger from real records only                            */
/* -------------------------------------------------------------------------- */

export type VaultTotals = {
  routed: Array<{ asset: string; amount: number; count: number }>;
  awaitingVerification: number;
  settled: number;
  disputed: number;
  open: number;
};

export function vaultTotals(tasks: PortTask[]): VaultTotals {
  const routed = new Map<string, { amount: number; count: number }>();
  tasks
    .filter((t) => t.reward && !isTerminal(t.state) || t.state === "SETTLED")
    .forEach((t) => {
      const asset = t.asset || "?";
      const entry = routed.get(asset) || { amount: 0, count: 0 };
      entry.amount += t.state === "SETTLED" ? t.settlement?.amount ?? t.reward ?? 0 : t.reward || 0;
      entry.count += 1;
      routed.set(asset, entry);
    });
  return {
    routed: [...routed.entries()].map(([asset, v]) => ({ asset, ...v })),
    awaitingVerification: tasks.filter((t) => t.state === "PROOF_SUBMITTED" || t.state === "VERIFYING").length,
    settled: tasks.filter((t) => t.state === "SETTLED").length,
    disputed: tasks.filter((t) => t.state === "DISPUTED").length,
    open: tasks.filter((t) => t.state === "OPEN" || t.state === "MATCHING").length,
  };
}

/* -------------------------------------------------------------------------- */
/* Record templates (what an agent or a human actually publishes)             */
/* -------------------------------------------------------------------------- */

export type TaskDraft = {
  category: TaskCategory;
  title: string;
  objective: string;
  city: string;
  area: string;
  reward: string;
  asset: string;
  duration: string;
  deadline: string;
  clearance: Clearance;
  proof: Array<{ type: ProofType; description: string }>;
};

export function renderTaskRecord(draft: TaskDraft) {
  const lines = [
    RECORD_MARKERS.task,
    `category: ${draft.category}`,
    `title: ${draft.title.trim()}`,
    `objective: ${draft.objective.trim().replace(/\s*\n\s*/g, " ")}`,
    `city: ${draft.city.trim()}`,
  ];
  if (draft.area.trim()) lines.push(`area: ${draft.area.trim()}`);
  lines.push(`reward: ${draft.reward.trim()} ${draft.asset.trim().toUpperCase()}`.trim());
  if (draft.duration.trim()) lines.push(`duration: ${draft.duration.trim()}`);
  if (draft.deadline.trim()) lines.push(`deadline: ${draft.deadline.trim()}`);
  lines.push(`clearance: ${draft.clearance}`);
  lines.push(`executor: human`);
  const proof = draft.proof.filter((p) => p.description.trim());
  if (proof.length) lines.push(`proof: ${proof.map((p) => `${p.type} ${p.description.trim()}`).join(" | ")}`);
  return lines.join("\n");
}

export function renderAcceptRecord(task: PortTask, eta?: string) {
  return [RECORD_MARKERS.accept, `task: ${task.ref}`, eta ? `eta: ${eta}` : null].filter(Boolean).join("\n");
}

export function renderAssignRecord(task: PortTask, human: PortActor) {
  return [RECORD_MARKERS.assign, `task: ${task.ref}`, `human: ${human.museId}`].join("\n");
}

export function renderDepartedRecord(task: PortTask) {
  return [RECORD_MARKERS.departed, `task: ${task.ref}`].join("\n");
}

export function renderOnSiteRecord(task: PortTask) {
  return [RECORD_MARKERS.onsite, `task: ${task.ref}`].join("\n");
}

export function renderProofRecord(task: PortTask, items: Array<{ type: string; value: string }>) {
  return [
    RECORD_MARKERS.proof,
    `task: ${task.ref}`,
    ...items.map((item, index) => `${String(index + 1).padStart(2, "0")}: ${item.type.toUpperCase()} ${item.value.trim()}`),
  ].join("\n");
}

export function renderVerifyRecord(task: PortTask, result: "accepted" | "rejected" | "reviewing", note: string) {
  return [RECORD_MARKERS.verify, `task: ${task.ref}`, `result: ${result}`, note.trim() ? `note: ${note.trim()}` : null]
    .filter(Boolean)
    .join("\n");
}

export function renderSettleRecord(
  task: PortTask,
  input: { amount: string; asset: string; rail: string; tx: string; recipient?: string },
) {
  return [
    RECORD_MARKERS.settle,
    `task: ${task.ref}`,
    `amount: ${input.amount.trim()}`,
    `asset: ${input.asset.trim().toUpperCase()}`,
    input.rail.trim() ? `rail: ${input.rail.trim()}` : null,
    input.tx.trim() ? `tx: ${input.tx.trim()}` : null,
    input.recipient?.trim() ? `recipient: ${input.recipient.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderWalletRecord(input: {
  address: string;
  chainId: string;
  challenge: string;
  signature: string;
}) {
  return [
    RECORD_MARKERS.wallet,
    `address: ${input.address}`,
    `chain_id: ${input.chainId}`,
    `challenge: ${input.challenge.replace(/\s+/g, " ").slice(0, 400)}`,
    `signature: ${input.signature}`,
  ].join("\n");
}

export function renderCancelRecord(task: PortTask, reason: string) {
  return [RECORD_MARKERS.cancel, `task: ${task.ref}`, reason.trim() ? `reason: ${reason.trim()}` : null].filter(Boolean).join("\n");
}

export function renderHumanRecord(input: { region: string; capabilities: TaskCategory[]; transport: string; languages: string }) {
  return [
    RECORD_MARKERS.human,
    `region: ${input.region.trim()}`,
    `capabilities: ${input.capabilities.join(" ")}`,
    input.transport.trim() ? `transport: ${input.transport.trim()}` : null,
    input.languages.trim() ? `languages: ${input.languages.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Safety: tasks PORT will not board                                          */
/* -------------------------------------------------------------------------- */

const PROHIBITED = [
  /\b(follow|track|tail|stalk|surveil)\b.*\b(person|woman|man|girl|boy|ex|wife|husband|partner)\b/i,
  /\b(home address|where (she|he|they) lives?)\b/i,
  /\b(gun|firearm|ammunition|weapon|explosive)\b/i,
  /\b(cocaine|heroin|meth|fentanyl|mdma|controlled substance)\b/i,
  /\b(password|credential|2fa|one[- ]time code|otp)\b.*\b(get|obtain|steal|read)\b/i,
  /\b(break in|pick the lock|bypass (the )?alarm|unauthori[sz]ed access)\b/i,
  /\b(fake (id|passport|receipt|invoice)|forg(e|ed|ery|ing)|counterfeit)\b/i,
];

/** Cheap, transparent pre-screen. It is a floor, not a moderation system. */
export function screenTask(text: string): { ok: boolean; reason?: string } {
  for (const rule of PROHIBITED) {
    if (rule.test(text)) {
      return { ok: false, reason: "This objective matches a prohibited pattern (surveillance, weapons, controlled substances, credential theft, unauthorised access, or forgery). PORT will not board it." };
    }
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatReward(task: Pick<PortTask, "reward" | "asset">) {
  if (task.reward === null) return task.asset || "—";
  const amount = task.reward % 1 === 0 ? task.reward.toLocaleString() : task.reward.toFixed(2);
  return `${amount} ${task.asset || ""}`.trim();
}

/** HH:MM in UTC — the board clock is UTC, so every time on it is too. */
export function clockOf(time: number) {
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function placeOf(task: Pick<PortTask, "city" | "area">) {
  return [task.city, task.area].filter(Boolean).join(" / ").toUpperCase() || "UNSPECIFIED";
}
