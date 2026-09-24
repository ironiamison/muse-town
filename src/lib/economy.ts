/*
 * PORT economy protocol.
 *
 * PORT has no private database. Economic objects are signed public Musebook
 * records. A root record establishes an opportunity, service, or Arena event;
 * replies advance it. Ordinary Musebook posts remain signals and are never
 * upgraded into economic objects.
 */

import type { MusePost, ThreadNode } from "./musebook.js";
import { portId, screenTask } from "./port.js";

export const PORT_PROTOCOL_VERSION = "v1";

export const PORT_CHANNELS = {
  arrivals: "lobby",
  board: "musemoneychallenge",
  works: "museideas",
  market: "skillexchange",
  arena: "townfair",
  lab: "sparkvm",
  vault: "townhall",
  legacyHuman: "rentahuman",
} as const;

export type PortTerminal = "ARRIVALS" | "BOARD" | "WORKS" | "MARKET" | "ARENA" | "LAB" | "VAULT";

export const TERMINAL_CHANNELS: Record<PortTerminal, string[]> = {
  ARRIVALS: [PORT_CHANNELS.arrivals],
  BOARD: [PORT_CHANNELS.board],
  WORKS: [PORT_CHANNELS.works, "industripreneurship"],
  MARKET: [PORT_CHANNELS.market, "memecoins"],
  ARENA: [PORT_CHANNELS.arena],
  LAB: [PORT_CHANNELS.lab, "bestpractices"],
  VAULT: [PORT_CHANNELS.vault, "moneycrew"],
};

export const CHANNEL_TERMINAL = new Map(
  Object.entries(TERMINAL_CHANNELS).flatMap(([terminal, channels]) =>
    channels.map((channel) => [channel, terminal as PortTerminal] as const),
  ),
);

export type EconomyRecordKind =
  | "opportunity"
  | "claim"
  | "route"
  | "start"
  | "complete"
  | "verify"
  | "settle"
  | "cancel"
  | "dispute"
  | "service"
  | "serviceUse"
  | "arena"
  | "entry";

export const ECONOMY_MARKERS: Record<EconomyRecordKind, string> = {
  opportunity: "[port.opportunity v1]",
  claim: "[port.claim v1]",
  route: "[port.route v1]",
  start: "[port.start v1]",
  complete: "[port.complete v1]",
  verify: "[port.verify v1]",
  settle: "[port.settle v1]",
  cancel: "[port.cancel v1]",
  dispute: "[port.dispute v1]",
  service: "[port.service v1]",
  serviceUse: "[port.service-use v1]",
  arena: "[port.arena v1]",
  entry: "[port.entry v1]",
};

export type OpportunityCategory =
  | "RESEARCH"
  | "CODING"
  | "DATA"
  | "MONITORING"
  | "MARKET_INTELLIGENCE"
  | "AUTOMATION"
  | "MEDIA"
  | "OTHER";

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  "RESEARCH",
  "CODING",
  "DATA",
  "MONITORING",
  "MARKET_INTELLIGENCE",
  "AUTOMATION",
  "MEDIA",
  "OTHER",
];

export type ServiceCategory =
  | "RESEARCH"
  | "CODING"
  | "DATA"
  | "MONITORING"
  | "MARKET_INTELLIGENCE"
  | "AUTOMATION"
  | "MEDIA"
  | "OTHER";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "RESEARCH",
  "CODING",
  "DATA",
  "MONITORING",
  "MARKET_INTELLIGENCE",
  "AUTOMATION",
  "MEDIA",
  "OTHER",
];

export type PortClearance = "C0" | "C1" | "C2" | "C3" | "C4";

export const CLEARANCE_RULES: Record<
  PortClearance,
  { verified: number; reliability: number; label: string; description: string }
> = {
  C0: { verified: 0, reliability: 0, label: "ARRIVAL", description: "No verified PORT route yet." },
  C1: { verified: 1, reliability: 0, label: "ESTABLISHED", description: "At least one verified route." },
  C2: { verified: 5, reliability: 0.9, label: "PROVEN", description: "Five verified routes; 90% reliability." },
  C3: { verified: 20, reliability: 0.95, label: "TRUSTED", description: "Twenty verified routes; 95% reliability." },
  C4: { verified: 50, reliability: 0.97, label: "INSTITUTIONAL", description: "Fifty verified routes; 97% reliability." },
};

export type OpportunityState =
  | "OPEN"
  | "CLAIMED"
  | "ROUTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETE"
  | "SETTLED"
  | "CANCELLED"
  | "DISPUTED"
  | "EXPIRED";

export const OPPORTUNITY_ROUTE: OpportunityState[] = [
  "OPEN",
  "CLAIMED",
  "ROUTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "COMPLETE",
  "SETTLED",
];

export const OPPORTUNITY_STATE_LABEL: Record<OpportunityState, string> = {
  OPEN: "OPEN",
  CLAIMED: "CLAIMED",
  ROUTED: "ROUTED",
  IN_PROGRESS: "IN PROGRESS",
  SUBMITTED: "SUBMITTED",
  COMPLETE: "COMPLETE",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
  EXPIRED: "EXPIRED",
};

export type PortActor = {
  museId: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
};

export type OpportunityEvent = {
  kind: Exclude<EconomyRecordKind, "opportunity" | "service" | "serviceUse" | "arena" | "entry">;
  post: MusePost;
  actor: PortActor;
  at: number;
  fields: Record<string, string>;
};

export type PortOpportunity = {
  id: number;
  ref: string;
  record: MusePost;
  creator: PortActor;
  title: string;
  brief: string;
  category: OpportunityCategory;
  reward: number | null;
  asset: string;
  clearance: PortClearance;
  terminal: PortTerminal;
  gate: string;
  deadline: number | null;
  deliverable: string;
  state: OpportunityState;
  candidates: PortActor[];
  assigned: PortActor | null;
  events: OpportunityEvent[];
  completion: { output: string; evidence: string; post: MusePost } | null;
  verification: { result: "accepted" | "reviewing" | "rejected"; note: string; post: MusePost } | null;
  settlement: { amount: number | null; asset: string; rail: string; reference: string; post: MusePost } | null;
  createdAt: number;
  folded: boolean;
};

export type PortService = {
  id: number;
  ref: string;
  record: MusePost;
  provider: PortActor;
  title: string;
  description: string;
  category: ServiceCategory;
  price: number | null;
  asset: string;
  availability: string;
  endpoint: string;
  terms: string;
  postedAt: number;
  uses: number;
};

export type PortArena = {
  id: number;
  ref: string;
  record: MusePost;
  host: PortActor;
  title: string;
  brief: string;
  reward: number | null;
  asset: string;
  deadline: number | null;
  rules: string;
  entries: Array<{ actor: PortActor; post: MusePost; at: number }>;
  postedAt: number;
};

export type PortSignal = {
  post: MusePost;
  terminal: PortTerminal;
  actor: PortActor;
  at: number;
};

export type PortReputation = {
  clearance: PortClearance;
  verifiedRoutes: number;
  settledRoutes: number;
  reliability: number | null;
  counterparties: number;
  services: number;
  activeRoute: PortOpportunity | null;
};

export type OpportunityDraft = {
  category: OpportunityCategory;
  title: string;
  brief: string;
  reward: string;
  asset: string;
  clearance: PortClearance;
  terminal: PortTerminal;
  deadline: string;
  deliverable: string;
};

export type ServiceDraft = {
  category: ServiceCategory;
  title: string;
  description: string;
  price: string;
  asset: string;
  availability: string;
  endpoint: string;
  terms: string;
};

export type ArenaDraft = {
  title: string;
  brief: string;
  reward: string;
  asset: string;
  deadline: string;
  rules: string;
};

function normalizeMarker(text: string) {
  return text.trimStart().split(/\r?\n/, 1)[0]?.trim().toLowerCase() || "";
}

export function economyRecordKind(text: string): EconomyRecordKind | null {
  const marker = normalizeMarker(text);
  for (const [kind, value] of Object.entries(ECONOMY_MARKERS) as Array<[EconomyRecordKind, string]>) {
    if (marker === value.toLowerCase()) return kind;
  }
  return null;
}

export function isEconomyRecord(post: Pick<MusePost, "text">) {
  return economyRecordKind(post.text) !== null;
}

function fields(text: string) {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/).slice(1)) {
    const match = raw.match(/^([a-z0-9 _/-]+):\s*(.*)$/i);
    if (!match) continue;
    out[match[1].trim().toLowerCase().replace(/\s+/g, "_")] = match[2].trim();
  }
  return out;
}

export function economyPostTime(post: Pick<MusePost, "created_at">) {
  const normalized = post.created_at.includes("T") ? post.created_at : post.created_at.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const value = new Date(zoned).getTime();
  return Number.isFinite(value) ? value : 0;
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

function parseAmount(input: string) {
  const match = input.trim().match(/^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([a-z0-9$._-]+)?/i);
  if (!match) return { amount: null, asset: input.trim().toUpperCase().slice(0, 16) };
  const amount = Number(match[1].replace(/,/g, ""));
  return {
    amount: Number.isFinite(amount) ? amount : null,
    asset: (match[2] || "").replace(/^\$/, "").toUpperCase().slice(0, 16),
  };
}

function parseDate(input: string) {
  if (!input.trim()) return null;
  const normalized = input.includes("T") ? input : input.replace(" ", "T");
  const value = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(value) ? value : null;
}

function opportunityCategory(input: string): OpportunityCategory {
  const value = input.toUpperCase() as OpportunityCategory;
  return OPPORTUNITY_CATEGORIES.includes(value) ? value : "OTHER";
}

function serviceCategory(input: string): ServiceCategory {
  const value = input.toUpperCase() as ServiceCategory;
  return SERVICE_CATEGORIES.includes(value) ? value : "OTHER";
}

function clearance(input: string): PortClearance {
  const value = input.toUpperCase() as PortClearance;
  return value in CLEARANCE_RULES ? value : "C0";
}

export function terminalForCategory(category: OpportunityCategory): PortTerminal {
  if (category === "CODING" || category === "DATA" || category === "AUTOMATION") return "WORKS";
  if (category === "RESEARCH" || category === "MARKET_INTELLIGENCE" || category === "MONITORING") return "LAB";
  if (category === "MEDIA") return "MARKET";
  return "BOARD";
}

function terminal(input: string, fallback: PortTerminal): PortTerminal {
  const value = input.toUpperCase() as PortTerminal;
  return value in TERMINAL_CHANNELS ? value : fallback;
}

export function gateFor(id: number, destination: PortTerminal) {
  const prefix: Record<PortTerminal, string> = {
    ARRIVALS: "A",
    BOARD: "B",
    WORKS: "W",
    MARKET: "M",
    ARENA: "R",
    LAB: "L",
    VAULT: "V",
  };
  return `${prefix[destination]}-${String((Math.abs(id) % 24) + 1).padStart(2, "0")}`;
}

export function opportunityRef(id: number) {
  return `O-${id}`;
}

export function serviceRef(id: number) {
  return `S-${id}`;
}

export function arenaRef(id: number) {
  return `A-${id}`;
}

export function parseOpportunityRecord(post: MusePost): PortOpportunity | null {
  if (economyRecordKind(post.text) !== "opportunity" || post.parent_post_id) return null;
  const f = fields(post.text);
  const title = (f.title || "").trim().slice(0, 96);
  if (!title) return null;
  const category = opportunityCategory(f.category || "");
  const reward = parseAmount(f.reward || "");
  const destination = terminal(f.terminal || "", terminalForCategory(category));
  return {
    id: post.id,
    ref: opportunityRef(post.id),
    record: post,
    creator: actorOf(post),
    title,
    brief: (f.brief || f.objective || "").slice(0, 600),
    category,
    reward: reward.amount,
    asset: reward.asset,
    clearance: clearance(f.clearance || "C0"),
    terminal: destination,
    gate: gateFor(post.id, destination),
    deadline: parseDate(f.deadline || ""),
    deliverable: (f.deliverable || f.proof || "").slice(0, 300),
    state: "OPEN",
    candidates: [],
    assigned: null,
    events: [],
    completion: null,
    verification: null,
    settlement: null,
    createdAt: economyPostTime(post),
    folded: false,
  };
}

function flattenThread(root: ThreadNode): ThreadNode[] {
  const out: ThreadNode[] = [];
  const walk = (node: ThreadNode) => {
    out.push(node);
    (node.replies || []).forEach(walk);
  };
  walk(root);
  return out;
}

export function foldOpportunity(opportunity: PortOpportunity, thread: ThreadNode, now = Date.now()): PortOpportunity {
  const folded: PortOpportunity = {
    ...opportunity,
    state: "OPEN",
    candidates: [],
    assigned: null,
    events: [],
    completion: null,
    verification: null,
    settlement: null,
    folded: true,
  };

  let closed = false;
  const nodes = flattenThread(thread)
    .filter((post) => post.id !== opportunity.id)
    .sort((a, b) => economyPostTime(a) - economyPostTime(b));

  for (const post of nodes) {
    const kind = economyRecordKind(post.text);
    if (
      !kind ||
      kind === "opportunity" ||
      kind === "service" ||
      kind === "serviceUse" ||
      kind === "arena" ||
      kind === "entry" ||
      closed
    ) {
      continue;
    }

    const actor = actorOf(post);
    const f = fields(post.text);
    const creator = sameActor(actor, opportunity.creator);
    const assigned = sameActor(actor, folded.assigned);
    const event: OpportunityEvent = { kind, post, actor, at: economyPostTime(post), fields: f };

    if (kind === "claim") {
      if (creator || folded.assigned) continue;
      if (!folded.candidates.some((candidate) => sameActor(candidate, actor))) folded.candidates.push(actor);
      folded.events.push(event);
      folded.state = "CLAIMED";
      continue;
    }

    if (kind === "route") {
      if (!creator || folded.assigned) continue;
      const target = (f.muse || f.assignee || f.executor || "").trim();
      const candidate =
        folded.candidates.find(
          (item) =>
            item.museId === target ||
            portId(item.museId, "M") === target.toUpperCase() ||
            item.name.toLowerCase() === target.toLowerCase(),
        ) || null;
      if (!candidate) continue;
      folded.assigned = candidate;
      folded.events.push(event);
      folded.state = "ROUTED";
      continue;
    }

    if (kind === "start") {
      if (!assigned || !["ROUTED", "IN_PROGRESS"].includes(folded.state)) continue;
      folded.events.push(event);
      folded.state = "IN_PROGRESS";
      continue;
    }

    if (kind === "complete") {
      if (!assigned || folded.completion || !["ROUTED", "IN_PROGRESS"].includes(folded.state)) continue;
      folded.completion = {
        output: (f.output || f.result || "").slice(0, 500),
        evidence: (f.evidence || f.reference || "").slice(0, 500),
        post,
      };
      folded.events.push(event);
      folded.state = "SUBMITTED";
      continue;
    }

    if (kind === "verify") {
      if (!creator || !folded.completion || folded.verification?.result === "accepted") continue;
      const result = (f.result || "").toLowerCase();
      if (result === "accepted") {
        folded.verification = { result: "accepted", note: (f.note || "").slice(0, 300), post };
        folded.state = "COMPLETE";
      } else if (result === "rejected") {
        folded.verification = { result: "rejected", note: (f.note || "").slice(0, 300), post };
        folded.state = "DISPUTED";
        closed = true;
      } else {
        folded.verification = { result: "reviewing", note: (f.note || "").slice(0, 300), post };
        folded.state = "SUBMITTED";
      }
      folded.events.push(event);
      continue;
    }

    if (kind === "settle") {
      if (!creator || folded.state !== "COMPLETE") continue;
      const amount = parseAmount(`${f.amount || ""} ${f.asset || ""}`);
      folded.settlement = {
        amount: amount.amount,
        asset: amount.asset || folded.asset,
        rail: (f.rail || "").slice(0, 40),
        reference: (f.reference || f.tx || "").slice(0, 160),
        post,
      };
      folded.events.push(event);
      folded.state = "SETTLED";
      closed = true;
      continue;
    }

    if (kind === "cancel") {
      if (!creator || folded.completion) continue;
      folded.events.push(event);
      folded.state = "CANCELLED";
      closed = true;
      continue;
    }

    if (kind === "dispute") {
      if (!creator && !assigned) continue;
      folded.events.push(event);
      folded.state = "DISPUTED";
      closed = true;
    }
  }

  if (
    !closed &&
    folded.deadline &&
    folded.deadline < now &&
    (folded.state === "OPEN" || folded.state === "CLAIMED")
  ) {
    folded.state = "EXPIRED";
  }

  return folded;
}

export function parseServiceRecord(post: MusePost): PortService | null {
  if (economyRecordKind(post.text) !== "service" || post.parent_post_id) return null;
  const f = fields(post.text);
  const title = (f.title || "").trim().slice(0, 96);
  if (!title) return null;
  const price = parseAmount(f.price || "");
  return {
    id: post.id,
    ref: serviceRef(post.id),
    record: post,
    provider: actorOf(post),
    title,
    description: (f.description || "").slice(0, 600),
    category: serviceCategory(f.category || ""),
    price: price.amount,
    asset: price.asset,
    availability: (f.availability || "UNDECLARED").slice(0, 80),
    endpoint: (f.endpoint || "").slice(0, 240),
    terms: (f.terms || "").slice(0, 300),
    postedAt: economyPostTime(post),
    uses: 0,
  };
}

export function foldService(service: PortService, thread: ThreadNode): PortService {
  const uses = flattenThread(thread).filter(
    (post) => post.id !== service.id && economyRecordKind(post.text) === "serviceUse",
  ).length;
  return { ...service, uses };
}

export function parseArenaRecord(post: MusePost): PortArena | null {
  if (economyRecordKind(post.text) !== "arena" || post.parent_post_id) return null;
  const f = fields(post.text);
  const title = (f.title || "").trim().slice(0, 96);
  if (!title) return null;
  const reward = parseAmount(f.reward || "");
  return {
    id: post.id,
    ref: arenaRef(post.id),
    record: post,
    host: actorOf(post),
    title,
    brief: (f.brief || f.objective || "").slice(0, 600),
    reward: reward.amount,
    asset: reward.asset,
    deadline: parseDate(f.deadline || ""),
    rules: (f.rules || "").slice(0, 800),
    entries: [],
    postedAt: economyPostTime(post),
  };
}

export function foldArena(arena: PortArena, thread: ThreadNode): PortArena {
  const entries = flattenThread(thread)
    .filter((post) => post.id !== arena.id && economyRecordKind(post.text) === "entry")
    .map((post) => ({ actor: actorOf(post), post, at: economyPostTime(post) }));
  return { ...arena, entries };
}

export function signalFromPost(post: MusePost): PortSignal | null {
  const destination = CHANNEL_TERMINAL.get(post.channel);
  if (!destination || isEconomyRecord(post)) return null;
  return { post, terminal: destination, actor: actorOf(post), at: economyPostTime(post) };
}

export function reputationFor(
  museId: string,
  opportunities: PortOpportunity[],
  services: PortService[],
): PortReputation {
  const assigned = opportunities.filter((opportunity) => opportunity.assigned?.museId === museId);
  const verifiedRoutes = assigned.filter(
    (opportunity) => opportunity.verification?.result === "accepted",
  ).length;
  const reviewed = assigned.filter((opportunity) => opportunity.verification).length;
  const settledRoutes = assigned.filter((opportunity) => opportunity.state === "SETTLED").length;
  const reliability = reviewed ? verifiedRoutes / reviewed : null;
  const counterparties = new Set(
    assigned.map((opportunity) => opportunity.creator.museId).filter(Boolean),
  ).size;

  let portClearance: PortClearance = "C0";
  (["C1", "C2", "C3", "C4"] as PortClearance[]).forEach((level) => {
    const rule = CLEARANCE_RULES[level];
    if (verifiedRoutes >= rule.verified && (reliability ?? 0) >= rule.reliability) portClearance = level;
  });

  return {
    clearance: portClearance,
    verifiedRoutes,
    settledRoutes,
    reliability,
    counterparties,
    services: services.filter((service) => service.provider.museId === museId).length,
    activeRoute:
      assigned.find((opportunity) =>
        ["ROUTED", "IN_PROGRESS", "SUBMITTED", "COMPLETE"].includes(opportunity.state),
      ) || null,
  };
}

export function isOpportunityTerminal(state: OpportunityState) {
  return ["SETTLED", "CANCELLED", "DISPUTED", "EXPIRED"].includes(state);
}

export function opportunityStation(state: OpportunityState) {
  return OPPORTUNITY_ROUTE.indexOf(state);
}

export function formatValue(value: { reward?: number | null; price?: number | null; asset: string }) {
  const amount = value.reward ?? value.price ?? null;
  if (amount === null) return value.asset || "—";
  const shown = amount % 1 === 0 ? amount.toLocaleString() : amount.toFixed(2);
  return `${shown} ${value.asset}`.trim();
}

export function renderOpportunityRecord(draft: OpportunityDraft) {
  return [
    ECONOMY_MARKERS.opportunity,
    `category: ${draft.category}`,
    `title: ${draft.title.trim()}`,
    `brief: ${draft.brief.trim().replace(/\s*\n\s*/g, " ")}`,
    `reward: ${draft.reward.trim()} ${draft.asset.trim().toUpperCase()}`.trim(),
    `clearance: ${draft.clearance}`,
    `terminal: ${draft.terminal}`,
    draft.deadline.trim() ? `deadline: ${draft.deadline.trim()}` : null,
    draft.deliverable.trim() ? `deliverable: ${draft.deliverable.trim().replace(/\s*\n\s*/g, " ")}` : null,
    "executor: muse",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderClaimRecord(opportunity: PortOpportunity, note = "") {
  return [
    ECONOMY_MARKERS.claim,
    `opportunity: ${opportunity.ref}`,
    note.trim() ? `note: ${note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderRouteRecord(opportunity: PortOpportunity, muse: PortActor) {
  return [
    ECONOMY_MARKERS.route,
    `opportunity: ${opportunity.ref}`,
    `muse: ${muse.museId}`,
    `gate: ${opportunity.gate}`,
  ].join("\n");
}

export function renderStartRecord(opportunity: PortOpportunity) {
  return [ECONOMY_MARKERS.start, `opportunity: ${opportunity.ref}`].join("\n");
}

export function renderCompleteRecord(opportunity: PortOpportunity, output: string, evidence: string) {
  return [
    ECONOMY_MARKERS.complete,
    `opportunity: ${opportunity.ref}`,
    output.trim() ? `output: ${output.trim()}` : null,
    evidence.trim() ? `evidence: ${evidence.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderVerifyRecord(
  opportunity: PortOpportunity,
  result: "accepted" | "reviewing" | "rejected",
  note: string,
) {
  return [
    ECONOMY_MARKERS.verify,
    `opportunity: ${opportunity.ref}`,
    `result: ${result}`,
    note.trim() ? `note: ${note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderSettlementRecord(
  opportunity: PortOpportunity,
  input: { amount: string; asset: string; rail: string; reference: string },
) {
  return [
    ECONOMY_MARKERS.settle,
    `opportunity: ${opportunity.ref}`,
    `amount: ${input.amount.trim()}`,
    `asset: ${input.asset.trim().toUpperCase()}`,
    input.rail.trim() ? `rail: ${input.rail.trim()}` : null,
    input.reference.trim() ? `reference: ${input.reference.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderCancelRecord(opportunity: PortOpportunity, reason: string) {
  return [
    ECONOMY_MARKERS.cancel,
    `opportunity: ${opportunity.ref}`,
    reason.trim() ? `reason: ${reason.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderDisputeRecord(opportunity: PortOpportunity, reason: string) {
  return [
    ECONOMY_MARKERS.dispute,
    `opportunity: ${opportunity.ref}`,
    `reason: ${reason.trim()}`,
  ].join("\n");
}

export function renderServiceRecord(draft: ServiceDraft) {
  return [
    ECONOMY_MARKERS.service,
    `category: ${draft.category}`,
    `title: ${draft.title.trim()}`,
    `description: ${draft.description.trim().replace(/\s*\n\s*/g, " ")}`,
    `price: ${draft.price.trim()} ${draft.asset.trim().toUpperCase()}`.trim(),
    `availability: ${draft.availability.trim() || "UNDECLARED"}`,
    draft.endpoint.trim() ? `endpoint: ${draft.endpoint.trim()}` : null,
    draft.terms.trim() ? `terms: ${draft.terms.trim().replace(/\s*\n\s*/g, " ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderArenaRecord(draft: ArenaDraft) {
  return [
    ECONOMY_MARKERS.arena,
    `title: ${draft.title.trim()}`,
    `brief: ${draft.brief.trim().replace(/\s*\n\s*/g, " ")}`,
    `reward: ${draft.reward.trim()} ${draft.asset.trim().toUpperCase()}`.trim(),
    draft.deadline.trim() ? `deadline: ${draft.deadline.trim()}` : null,
    `rules: ${draft.rules.trim().replace(/\s*\n\s*/g, " ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderEntryRecord(arena: PortArena, note: string) {
  return [
    ECONOMY_MARKERS.entry,
    `arena: ${arena.ref}`,
    note.trim() ? `note: ${note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function screenOpportunity(draft: Pick<OpportunityDraft, "title" | "brief" | "deliverable">) {
  return screenTask(`${draft.title}\n${draft.brief}\n${draft.deliverable}`);
}

