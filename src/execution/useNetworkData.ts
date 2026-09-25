import { useCallback, useEffect, useMemo, useState } from "react";
import { getLatest, getMuses, getStats, getThread, type MusePost, type MuseResident } from "../lib/musebook";
import {
  humanReputation,
  type PortContribution,
  type PortHuman,
  type PortMuse,
  type PortReward,
  type PortTask,
  type PortWalletLink,
} from "../lib/port";
import { foldOpportunity, parseOpportunityRecord, parseServiceRecord, type PortOpportunity, type PortService } from "../lib/economy";
import {
  LedgerNotConfiguredError,
  getFoundingCampaign,
  getPonsFunding,
  getPortTaskSnapshot,
  type FoundingCampaignPayload,
  type PonsFundingPayload,
} from "../lib/port-api";
import { humanExecutor, normalizeOpportunity, normalizePortTask, serviceExecutor, type Execution, type Executor } from "../lib/execution";
import { mergeSkills } from "../lib/skills";
import { deriveRewardSummary } from "../lib/rewards";

/**
 * live       — the MuseTools ledger answered
 * offline    — the ledger could not be reached
 * unconfigured — this deployment has no ledger database yet (honest empty state)
 */
export type NetworkState = "loading" | "live" | "offline" | "unconfigured";

/* Optional read-only sources: signed skill and opportunity records other Muses publish on Musebook. */
const ECONOMY_CHANNELS = ["musemoneychallenge", "museideas", "skillexchange"] as const;

function uniquePosts(posts: MusePost[]) {
  const found = new Map<number, MusePost>();
  posts.forEach((post) => found.set(post.id, post));
  return [...found.values()];
}

function parseTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const result = new Date(zoned).getTime();
  return Number.isFinite(result) ? result : 0;
}

export function useNetworkData() {
  const [state, setState] = useState<NetworkState>("loading");
  const [residents, setResidents] = useState<MuseResident[]>([]);
  const [posts, setPosts] = useState<MusePost[]>([]);
  const [tasks, setTasks] = useState<PortTask[]>([]);
  const [humans, setHumans] = useState<PortHuman[]>([]);
  const [walletLinks, setWalletLinks] = useState<PortWalletLink[]>([]);
  const [muses, setMuses] = useState<PortMuse[]>([]);
  const [contributions, setContributions] = useState<PortContribution[]>([]);
  const [signedRewards, setSignedRewards] = useState<PortReward[]>([]);
  const [founding, setFounding] = useState<FoundingCampaignPayload | null>(null);
  const [pons, setPons] = useState<PonsFundingPayload | null>(null);
  const [opportunities, setOpportunities] = useState<PortOpportunity[]>([]);
  const [services, setServices] = useState<PortService[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [head, setHead] = useState<{ seq: number; hash: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const sync = useCallback(async () => {
    setState((current) => (current === "live" ? current : "loading"));

    /* The ledger is applied the moment it answers; optional sources never delay it. */
    const optional = Promise.allSettled([
      getMuses(),
      getStats(),
      getFoundingCampaign(),
      getPonsFunding(),
      ...ECONOMY_CHANNELS.map((channel) => getLatest(channel)),
    ]);
    const [snapshotResult] = await Promise.allSettled([getPortTaskSnapshot(50)]);

    let ledgerPosts: MusePost[] = [];
    if (snapshotResult.status === "rejected") {
      setState(snapshotResult.reason instanceof LedgerNotConfiguredError ? "unconfigured" : "offline");
    } else {
      const snapshot = snapshotResult.value;
      ledgerPosts = [
        ...snapshot.tasks.map((task) => task.record),
        ...snapshot.tasks.flatMap((task) => task.events.map((event) => event.post)),
        ...snapshot.humans.map((human) => human.declaration),
        ...snapshot.walletLinks.map((link) => link.record),
        ...snapshot.muses.map((muse) => muse.declaration),
        ...snapshot.contributions.map((contribution) => contribution.record),
        ...snapshot.rewards.map((reward) => reward.record),
      ];
      setTasks(snapshot.tasks);
      setWalletLinks(snapshot.walletLinks);
      setHumans(snapshot.humans);
      setMuses(snapshot.muses);
      setContributions(snapshot.contributions);
      setSignedRewards(snapshot.rewards);
      setHead(snapshot.head);
      setPosts((current) => uniquePosts([...ledgerPosts, ...current]).sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at)));
      setLastSyncedAt(Date.now());
      setState("live");
    }

    const [directoryResult, statsResult, foundingResult, ponsResult, ...economyResults] = await optional;
    setResidents(directoryResult.status === "fulfilled" ? directoryResult.value : []);
    setStats(statsResult.status === "fulfilled" ? statsResult.value : {});
    if (foundingResult.status === "fulfilled") setFounding(foundingResult.value);
    if (ponsResult.status === "fulfilled") setPons(ponsResult.value);

    const economyPosts = economyResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const opportunityRoots = economyPosts.filter((post) => !post.parent_post_id && parseOpportunityRecord(post)).slice(0, 16);
    const opportunityThreads = await Promise.allSettled(opportunityRoots.map((post) => getThread(post.id)));
    setOpportunities(
      opportunityRoots.flatMap((post, index) => {
        const parsed = parseOpportunityRecord(post);
        if (!parsed) return [];
        const thread = opportunityThreads[index];
        return [thread.status === "fulfilled" ? foldOpportunity(parsed, thread.value.thread) : parsed];
      }),
    );
    setServices(
      economyPosts
        .filter((post) => !post.parent_post_id)
        .flatMap((post) => {
          const service = parseServiceRecord(post);
          return service ? [service] : [];
        }),
    );
    setPosts(uniquePosts([...ledgerPosts, ...economyPosts]).sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at)));
  }, []);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(), 30_000);
    return () => window.clearInterval(timer);
  }, [sync]);

  const executions = useMemo<Execution[]>(
    () =>
      [...tasks.map(normalizePortTask), ...opportunities.map(normalizeOpportunity)].sort((a, b) => {
        const activityA = a.completedAt || a.acceptedAt || a.createdAt;
        const activityB = b.completedAt || b.acceptedAt || b.createdAt;
        return activityB - activityA;
      }),
    [opportunities, tasks],
  );

  const executors = useMemo<Executor[]>(
    () => [
      ...humans.map((human) => humanExecutor(human, humanReputation(human.actor.museId, tasks), tasks)),
      ...services.map(serviceExecutor),
    ],
    [humans, services, tasks],
  );
  const skills = useMemo(() => mergeSkills(services), [services]);
  const rewards = useMemo(
    () =>
      deriveRewardSummary(
        tasks,
        opportunities,
        services,
        undefined,
        signedRewards,
        founding?.funding.issuance_active,
      ),
    [founding?.funding.issuance_active, opportunities, services, signedRewards, tasks],
  );

  return {
    state,
    residents,
    posts,
    tasks,
    humans,
    walletLinks,
    muses,
    contributions,
    signedRewards,
    founding,
    pons,
    opportunities,
    services,
    stats,
    head,
    executions,
    executors,
    skills,
    rewards,
    lastSyncedAt,
    sync,
  };
}
