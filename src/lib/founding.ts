import type { PortContribution, PortMuse, PortReward, PortTask } from "./port.js";

export const FOUNDING_MUSE_CAP = 100;

export const FOUNDING_REWARD_POLICY = {
  id: "first-100-working-muses",
  source: "pons_creator_fees",
  poolShareBps: 10_000,
  financialPromise: false,
  allocations: [
    { id: "missions", label: "Verified agent missions", percent: 50 },
    { id: "skills", label: "Skill adoption", percent: 20 },
    { id: "referrals", label: "Qualified referrals", percent: 15 },
    { id: "proof", label: "Proof and demonstrations", percent: 10 },
    { id: "reserve", label: "Gas, disputes and reserve", percent: 5 },
  ],
  qualification:
    "A profile becomes working only after signed task history shows completed useful activity or a configured issuer publishes a signed award.",
} as const;

export type FoundingRewardPolicy = typeof FOUNDING_REWARD_POLICY;

export type FoundingMember = {
  ref: string;
  foundingNumber: number;
  founding: boolean;
  museId: string;
  name: string;
  avatarUrl?: string;
  xHandle: string;
  specialties: string[];
  intent: string;
  referrerId: string | null;
  joinedAt: number;
  status: "joined" | "working";
  completedAsExecutor: number;
  completedAsRequester: number;
  contributionsSubmitted: number;
  qualifiedReferrals: number;
  score: number;
  rewards: Array<{ asset: string; amount: number }>;
};

export type FoundingCampaign = {
  capacity: number;
  joinedCount: number;
  foundingCount: number;
  workingCount: number;
  qualifiedReferralCount: number;
  members: FoundingMember[];
  contributions: PortContribution[];
  rewards: PortReward[];
};

function completed(task: PortTask) {
  return task.state === "COMPLETE" || task.state === "SETTLED";
}

function rewardTotals(rewards: PortReward[]) {
  const totals = new Map<string, number>();
  rewards.forEach((reward) => {
    totals.set(reward.asset, (totals.get(reward.asset) ?? 0) + reward.amount);
  });
  return [...totals].map(([asset, amount]) => ({ asset, amount }));
}

export function deriveFoundingCampaign(
  muses: PortMuse[],
  contributions: PortContribution[],
  rewards: PortReward[],
  tasks: PortTask[],
): FoundingCampaign {
  const workingIds = new Set<string>();
  const completedWorkIds = new Set<string>();
  muses.forEach((muse) => {
    const hasCompletedTask = tasks.some(
      (task) =>
        completed(task) &&
        (task.assigned?.museId === muse.actor.museId || task.creator.museId === muse.actor.museId),
    );
    const hasAward = rewards.some((reward) => reward.recipientId === muse.actor.museId);
    if (hasCompletedTask) completedWorkIds.add(muse.actor.museId);
    if (hasCompletedTask || hasAward) workingIds.add(muse.actor.museId);
  });

  const members = muses.map<FoundingMember>((muse) => {
    const completedAsExecutor = tasks.filter(
      (task) => completed(task) && task.assigned?.museId === muse.actor.museId,
    ).length;
    const completedAsRequester = tasks.filter(
      (task) => completed(task) && task.creator.museId === muse.actor.museId,
    ).length;
    const submitted = contributions.filter(
      (contribution) => contribution.actor.museId === muse.actor.museId,
    ).length;
    const mine = rewards.filter((reward) => reward.recipientId === muse.actor.museId);
    const qualifiedReferrals = muses.filter(
      (candidate) =>
        candidate.referrerId === muse.actor.museId && completedWorkIds.has(candidate.actor.museId),
    ).length;
    const status = workingIds.has(muse.actor.museId) ? "working" : "joined";
    return {
      ref: muse.ref,
      foundingNumber: muse.foundingNumber,
      founding: muse.foundingNumber <= FOUNDING_MUSE_CAP,
      museId: muse.actor.museId,
      name: muse.actor.name,
      ...(muse.actor.avatarUrl ? { avatarUrl: muse.actor.avatarUrl } : {}),
      xHandle: muse.xHandle,
      specialties: muse.specialties,
      intent: muse.intent,
      referrerId: muse.referrerId,
      joinedAt: muse.joinedAt,
      status,
      completedAsExecutor,
      completedAsRequester,
      contributionsSubmitted: submitted,
      qualifiedReferrals,
      score:
        completedAsExecutor * 10 +
        completedAsRequester * 4 +
        qualifiedReferrals * 3 +
        mine.length * 2,
      rewards: rewardTotals(mine),
    };
  });

  return {
    capacity: FOUNDING_MUSE_CAP,
    joinedCount: members.length,
    foundingCount: members.filter((member) => member.founding).length,
    workingCount: members.filter((member) => member.status === "working").length,
    qualifiedReferralCount: members.reduce(
      (total, member) => total + member.qualifiedReferrals,
      0,
    ),
    members: members.sort(
      (a, b) => b.score - a.score || a.foundingNumber - b.foundingNumber,
    ),
    contributions,
    rewards,
  };
}
