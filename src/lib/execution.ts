import type { MusePost } from "./musebook.js";
import type {
  HumanReputation,
  PortActor,
  PortHuman,
  PortTask,
  ProofType,
  TaskState,
} from "./port.js";
import type { PortOpportunity, PortService } from "./economy.js";
import {
  CAPABILITY_BY_ID,
  findCapabilityForTask,
  type Capability,
  type ExecutorType,
} from "./capabilities.js";

export type RequesterType = "agent" | "human" | "service" | "business";
export type ExecutionStatus =
  | "CREATED"
  | "MATCHING"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "PROOF_SUBMITTED"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED"
  | "CANCELLED"
  | "DISPUTED";
export type PaymentStatus = "NOT_REQUIRED" | "PENDING" | "DECLARED_PAID" | "UNKNOWN";

export type NetworkParty = {
  id: string;
  name: string;
  type: RequesterType | ExecutorType;
  avatarUrl?: string;
  verified?: boolean;
  location?: string;
};

export type ExecutionLocation = {
  city?: string;
  area?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

export type ExecutionProof = {
  type: ProofType | string;
  value: string;
  verified: boolean | null;
};

export type Execution = {
  id: string;
  source: "port/1" | "port-economy/1";
  sourceId: number;
  requester: NetworkParty;
  requesterType: RequesterType;
  capability: Capability;
  instructions: string;
  title: string;
  location: ExecutionLocation | null;
  budget: { amount: number | null; currency: string };
  deadline: number | null;
  executor: NetworkParty | null;
  executorType: ExecutorType;
  status: ExecutionStatus;
  sourceStatus: TaskState | string;
  proofRequirements: Array<{ type: ProofType | string; description: string }>;
  proof: ExecutionProof[];
  result: { accepted: boolean | null; note: string; output?: string } | null;
  createdAt: number;
  acceptedAt: number | null;
  completedAt: number | null;
  payment: {
    status: PaymentStatus;
    amount: number | null;
    currency: string;
    rail?: string;
    reference?: string;
    recipient?: string;
  };
  publicRecordUrl: string;
  folded: boolean;
};

export type Executor = {
  id: string;
  name: string;
  type: ExecutorType;
  avatarUrl?: string;
  verified?: boolean;
  availability: "available" | "busy" | "unknown";
  locations: string[];
  capabilities: string[];
  reputation: {
    executionsCompleted: number;
    successRate: number | null;
    averageResponseTime: number | null;
    clearance?: string;
  };
  source: "declaration" | "observed" | "service";
};

const taskStatusMap: Record<TaskState, ExecutionStatus> = {
  OPEN: "CREATED",
  MATCHING: "MATCHING",
  ASSIGNED: "CLAIMED",
  DEPARTED: "IN_PROGRESS",
  ON_SITE: "IN_PROGRESS",
  PROOF_SUBMITTED: "PROOF_SUBMITTED",
  VERIFYING: "VERIFYING",
  COMPLETE: "COMPLETE",
  SETTLED: "COMPLETE",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
  EXPIRED: "FAILED",
};

const opportunityCapability: Record<string, string> = {
  RESEARCH: "research",
  CODING: "generate",
  DATA: "process_data",
  MONITORING: "monitor",
  MARKET_INTELLIGENCE: "research",
  AUTOMATION: "use_service",
  MEDIA: "generate",
  OTHER: "hire_agent",
};

function actorParty(actor: PortActor, type: NetworkParty["type"], location?: string): NetworkParty {
  return {
    id: actor.museId,
    name: actor.name,
    type,
    avatarUrl: actor.avatarUrl,
    verified: actor.verified,
    location,
  };
}

function recordUrl(post: Pick<MusePost, "id">) {
  return `https://musebook.me/post/${post.id}`;
}

function eventTime(task: PortTask, kind: string) {
  for (let index = task.events.length - 1; index >= 0; index -= 1) {
    if (task.events[index].kind === kind) return task.events[index].at;
  }
  return null;
}

function opportunityEventTime(opportunity: PortOpportunity, kind: string) {
  for (let index = opportunity.events.length - 1; index >= 0; index -= 1) {
    if (opportunity.events[index].kind === kind) return opportunity.events[index].at;
  }
  return null;
}

export function normalizePortTask(task: PortTask): Execution {
  const capability = findCapabilityForTask(task.category);
  const accepted = task.verification?.result === "accepted";
  const completedAt =
    eventTime(task, "verify") ??
    eventTime(task, "proof") ??
    (task.state === "COMPLETE" || task.state === "SETTLED" ? task.createdAt : null);

  return {
    id: task.ref,
    source: "port/1",
    sourceId: task.id,
    requester: actorParty(task.creator, "agent"),
    requesterType: "agent",
    capability,
    instructions: task.objective,
    title: task.title,
    location:
      task.city || task.area
        ? {
            city: task.city || undefined,
            area: task.area || undefined,
          }
        : null,
    budget: { amount: task.reward, currency: task.asset || "USD" },
    deadline: task.deadline,
    executor: task.assigned
      ? actorParty(
          task.assigned,
          task.executor,
          [task.area, task.city].filter(Boolean).join(", ") || undefined,
        )
      : null,
    executorType: task.executor,
    status: taskStatusMap[task.state],
    sourceStatus: task.state,
    proofRequirements: task.proofRequired.map((requirement) => ({
      type: requirement.type,
      description: requirement.description,
    })),
    proof:
      task.proof?.items.map((item) => ({
        type: item.type,
        value: item.value,
        verified: task.verification ? accepted : null,
      })) ?? [],
    result: task.verification
      ? {
          accepted,
          note: task.verification.note,
        }
      : null,
    createdAt: task.createdAt,
    acceptedAt: task.acceptedAt,
    completedAt,
    payment: task.settlement
      ? {
          status: "DECLARED_PAID",
          amount: task.settlement.amount,
          currency: task.settlement.asset || task.asset || "USD",
          rail: task.settlement.rail,
          reference: task.settlement.tx,
          recipient: task.settlement.recipient,
        }
      : {
          status: task.reward === 0 ? "NOT_REQUIRED" : "PENDING",
          amount: task.reward,
          currency: task.asset || "USD",
        },
    publicRecordUrl: recordUrl(task.record),
    folded: task.folded,
  };
}

function opportunityStatus(state: string): ExecutionStatus {
  if (state === "OPEN") return "CREATED";
  if (state === "CLAIMED" || state === "ROUTED") return "CLAIMED";
  if (state === "IN_PROGRESS") return "IN_PROGRESS";
  if (state === "SUBMITTED") return "PROOF_SUBMITTED";
  if (state === "COMPLETE" || state === "SETTLED") return "COMPLETE";
  if (state === "CANCELLED") return "CANCELLED";
  if (state === "DISPUTED") return "DISPUTED";
  return "FAILED";
}

export function normalizeOpportunity(opportunity: PortOpportunity): Execution {
  const capability =
    CAPABILITY_BY_ID.get(opportunityCapability[opportunity.category] ?? "hire_agent") ??
    CAPABILITY_BY_ID.get("hire_agent")!;

  return {
    id: opportunity.ref,
    source: "port-economy/1",
    sourceId: opportunity.id,
    requester: actorParty(opportunity.creator, "agent"),
    requesterType: "agent",
    capability,
    instructions: opportunity.brief,
    title: opportunity.title,
    location: null,
    budget: { amount: opportunity.reward, currency: opportunity.asset || "USD" },
    deadline: opportunity.deadline,
    executor: opportunity.assigned ? actorParty(opportunity.assigned, "agent") : null,
    executorType: "agent",
    status: opportunityStatus(opportunity.state),
    sourceStatus: opportunity.state,
    proofRequirements: opportunity.deliverable
      ? [{ type: "OUTPUT", description: opportunity.deliverable }]
      : [],
    proof: opportunity.completion
      ? [
          {
            type: "OUTPUT",
            value: opportunity.completion.output,
            verified: opportunity.verification
              ? opportunity.verification.result === "accepted"
              : null,
          },
          ...(opportunity.completion.evidence
            ? [
                {
                  type: "DOCUMENT",
                  value: opportunity.completion.evidence,
                  verified: opportunity.verification
                    ? opportunity.verification.result === "accepted"
                    : null,
                },
              ]
            : []),
        ]
      : [],
    result: opportunity.verification
      ? {
          accepted: opportunity.verification.result === "accepted",
          note: opportunity.verification.note,
          output: opportunity.completion?.output,
        }
      : null,
    createdAt: opportunity.createdAt,
    acceptedAt: opportunityEventTime(opportunity, "claim"),
    completedAt: opportunityEventTime(opportunity, "verify"),
    payment: opportunity.settlement
      ? {
          status: "DECLARED_PAID",
          amount: opportunity.settlement.amount,
          currency: opportunity.settlement.asset || opportunity.asset || "USD",
          rail: opportunity.settlement.rail,
          reference: opportunity.settlement.reference,
        }
      : {
          status: opportunity.reward === 0 ? "NOT_REQUIRED" : "PENDING",
          amount: opportunity.reward,
          currency: opportunity.asset || "USD",
        },
    publicRecordUrl: recordUrl(opportunity.record),
    folded: opportunity.folded,
  };
}

export function humanExecutor(
  human: PortHuman,
  reputation: HumanReputation,
  tasks: PortTask[],
): Executor {
  const assigned = tasks.filter((task) => task.assigned?.museId === human.actor.museId);
  const active = assigned.some(
    (task) => !["COMPLETE", "SETTLED", "CANCELLED", "DISPUTED", "EXPIRED"].includes(task.state),
  );
  return {
    id: human.actor.museId,
    name: human.actor.name,
    type: "human",
    avatarUrl: human.actor.avatarUrl,
    verified: human.actor.verified,
    availability: active ? "busy" : "available",
    locations: [human.region, ...reputation.regions].filter(
      (region, index, regions) => Boolean(region) && regions.indexOf(region) === index,
    ),
    capabilities: human.capabilities.map((category) => findCapabilityForTask(category).id),
    reputation: {
      executionsCompleted: reputation.tasksSettled,
      successRate: reputation.acceptanceRate,
      averageResponseTime: null,
      clearance: reputation.clearance,
    },
    source: "declaration",
  };
}

export function serviceExecutor(service: PortService): Executor {
  return {
    id: service.ref,
    name: service.title,
    type: "service",
    avatarUrl: service.provider.avatarUrl,
    verified: service.provider.verified,
    availability: service.availability ? "available" : "unknown",
    locations: [],
    capabilities: [
      opportunityCapability[service.category] ?? "use_service",
    ],
    reputation: {
      executionsCompleted: service.uses,
      successRate: null,
      averageResponseTime: null,
    },
    source: "service",
  };
}

export function publicExecution(execution: Execution) {
  return {
    id: execution.id,
    source: execution.source,
    requester: execution.requester,
    requester_type: execution.requesterType,
    capability: {
      id: execution.capability.id,
      name: execution.capability.name,
      category: execution.capability.category,
    },
    title: execution.title,
    instructions: execution.instructions,
    location: execution.location,
    budget: execution.budget,
    deadline: execution.deadline ? new Date(execution.deadline).toISOString() : null,
    executor: execution.executor,
    executor_type: execution.executorType,
    status: execution.status,
    source_status: execution.sourceStatus,
    proof_requirements: execution.proofRequirements.map((proof) => ({
      type: String(proof.type).toLowerCase(),
      description: proof.description,
    })),
    proof: execution.proof.map((proof) => ({
      type: String(proof.type).toLowerCase(),
      value: proof.value,
      verified: proof.verified,
    })),
    result: execution.result,
    created_at: new Date(execution.createdAt).toISOString(),
    accepted_at: execution.acceptedAt
      ? new Date(execution.acceptedAt).toISOString()
      : null,
    completed_at: execution.completedAt
      ? new Date(execution.completedAt).toISOString()
      : null,
    payment: execution.payment,
    public_record_url: execution.publicRecordUrl,
    folded: execution.folded,
  };
}

export function formatExecutionReward(execution: Pick<Execution, "budget">) {
  if (execution.budget.amount === null) return "Reward set by requester";
  const currency = execution.budget.currency.toUpperCase();
  if (currency === "USD" || currency === "USDC")
    return `$${execution.budget.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}${
      currency === "USDC" ? " USDC" : ""
    }`;
  return `${execution.budget.amount.toLocaleString()} ${currency}`;
}

export function locationLabel(location: ExecutionLocation | null) {
  if (!location) return "Remote";
  return [location.area, location.city, location.country].filter(Boolean).join(", ") || "Location required";
}
