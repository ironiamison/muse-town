import type { PortOpportunity, PortService } from "./economy.js";
import type { PortTask } from "./port.js";

export type RewardPolicy = {
  id: string;
  active: boolean;
  description: string;
  eventKinds: RewardEventKind[];
  rate: number | null;
  currency: string | null;
  cap: number | null;
};

export type RewardEventKind =
  | "human_execution_completed"
  | "human_execution_used"
  | "skill_invoked"
  | "skill_published_and_used"
  | "useful_activity_routed";

export type ActivityLedgerEntry = {
  id: string;
  kind: "network_activity" | "earning" | "reward";
  event: RewardEventKind | "payment_recorded";
  label: string;
  actorId: string | null;
  counterpartyId: string | null;
  amount: number | null;
  currency: string | null;
  createdAt: number;
  sourceRef: string;
  finality: "signed_claim" | "computed_history" | "policy_award";
};

export type RewardSummary = {
  networkActivity: {
    executions: number;
    humansHired: number;
    skillsUsed: number;
    volume: Array<{ currency: string; amount: number }>;
  };
  earnings: Array<{ currency: string; amount: number }>;
  rewards: Array<{ currency: string; amount: number }>;
  rewardIssuanceActive: boolean;
  entries: ActivityLedgerEntry[];
};

export const REWARD_POLICIES: RewardPolicy[] = [
  {
    id: "useful-economic-activity",
    active: false,
    description:
      "Reserved for configurable rewards tied to completed, verified economic activity. No issuance is active.",
    eventKinds: [
      "human_execution_completed",
      "human_execution_used",
      "skill_invoked",
      "skill_published_and_used",
      "useful_activity_routed",
    ],
    rate: null,
    currency: null,
    cap: null,
  },
];

function addAmount(
  target: Map<string, number>,
  currency: string,
  amount: number | null,
) {
  if (amount === null || !Number.isFinite(amount)) return;
  const asset = currency.toUpperCase() || "USD";
  target.set(asset, (target.get(asset) ?? 0) + amount);
}

export function deriveRewardSummary(
  tasks: PortTask[],
  opportunities: PortOpportunity[],
  services: PortService[],
  actorId?: string,
): RewardSummary {
  const entries: ActivityLedgerEntry[] = [];
  const volume = new Map<string, number>();
  const earnings = new Map<string, number>();

  tasks.forEach((task) => {
    const complete = task.state === "COMPLETE" || task.state === "SETTLED";
    if (complete) {
      entries.push({
        id: `${task.ref}:complete`,
        kind: "network_activity",
        event: "human_execution_completed",
        label: `${task.title} completed`,
        actorId: task.assigned?.museId ?? null,
        counterpartyId: task.creator.museId,
        amount: task.reward,
        currency: task.asset,
        createdAt:
          task.events.find((event) => event.kind === "verify")?.at ?? task.createdAt,
        sourceRef: task.ref,
        finality: "computed_history",
      });
      addAmount(volume, task.asset, task.reward);
    }
    if (task.settlement) {
      entries.push({
        id: `${task.ref}:settle`,
        kind: "earning",
        event: "payment_recorded",
        label: `Payment recorded for ${task.title}`,
        actorId: task.assigned?.museId ?? null,
        counterpartyId: task.creator.museId,
        amount: task.settlement.amount,
        currency: task.settlement.asset,
        createdAt:
          task.events.find((event) => event.kind === "settle")?.at ?? task.createdAt,
        sourceRef: task.ref,
        finality: "signed_claim",
      });
      if (!actorId || task.assigned?.museId === actorId)
        addAmount(earnings, task.settlement.asset, task.settlement.amount);
    }
  });

  opportunities.forEach((opportunity) => {
    if (opportunity.state === "COMPLETE" || opportunity.state === "SETTLED") {
      entries.push({
        id: `${opportunity.ref}:complete`,
        kind: "network_activity",
        event: "useful_activity_routed",
        label: `${opportunity.title} completed`,
        actorId: opportunity.assigned?.museId ?? null,
        counterpartyId: opportunity.creator.museId,
        amount: opportunity.reward,
        currency: opportunity.asset,
        createdAt: opportunity.createdAt,
        sourceRef: opportunity.ref,
        finality: "computed_history",
      });
      addAmount(volume, opportunity.asset, opportunity.reward);
    }
    if (opportunity.settlement && (!actorId || opportunity.assigned?.museId === actorId)) {
      addAmount(
        earnings,
        opportunity.settlement.asset,
        opportunity.settlement.amount,
      );
    }
  });

  services.forEach((service) => {
    if (!service.uses) return;
    entries.push({
      id: `${service.ref}:uses`,
      kind: "network_activity",
      event: "skill_published_and_used",
      label: `${service.title} used ${service.uses} times`,
      actorId: service.provider.museId,
      counterpartyId: null,
      amount:
        service.price === null ? null : service.price * service.uses,
      currency: service.asset,
      createdAt: service.postedAt,
      sourceRef: service.ref,
      finality: "computed_history",
    });
  });

  return {
    networkActivity: {
      executions: entries.filter(
        (entry) => entry.event === "human_execution_completed",
      ).length,
      humansHired: new Set(
        tasks
          .filter((task) => task.assigned)
          .map((task) => task.assigned!.museId),
      ).size,
      skillsUsed: services.reduce((sum, service) => sum + service.uses, 0),
      volume: [...volume].map(([currency, amount]) => ({ currency, amount })),
    },
    earnings: [...earnings].map(([currency, amount]) => ({ currency, amount })),
    rewards: [],
    rewardIssuanceActive: REWARD_POLICIES.some((policy) => policy.active),
    entries: entries.sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function publicRewardSummary(summary: RewardSummary) {
  return {
    network_activity: {
      executions: summary.networkActivity.executions,
      humans_hired: summary.networkActivity.humansHired,
      skills_used: summary.networkActivity.skillsUsed,
      volume: summary.networkActivity.volume,
    },
    earnings: summary.earnings,
    rewards: summary.rewards,
    reward_issuance_active: summary.rewardIssuanceActive,
    entries: summary.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      event: entry.event,
      label: entry.label,
      actor_id: entry.actorId,
      counterparty_id: entry.counterpartyId,
      amount: entry.amount,
      currency: entry.currency,
      created_at: new Date(entry.createdAt).toISOString(),
      source_ref: entry.sourceRef,
      finality: entry.finality,
    })),
  };
}
