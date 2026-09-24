import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLatest,
  getMuses,
  getStats,
  getThread,
  type MusePost,
  type MuseResident,
  type ThreadNode,
} from "../lib/musebook";
import {
  PORT_CHANNEL,
  foldHumans,
  foldTask,
  foldWalletLinks,
  humanReputation,
  parseTaskRecord,
  type PortHuman,
  type PortTask,
  type PortWalletLink,
} from "../lib/port";
import {
  foldOpportunity,
  parseOpportunityRecord,
  parseServiceRecord,
  type PortOpportunity,
  type PortService,
} from "../lib/economy";
import { getPortTaskSnapshot } from "../lib/port-api";
import {
  humanExecutor,
  normalizeOpportunity,
  normalizePortTask,
  serviceExecutor,
  type Execution,
  type Executor,
} from "../lib/execution";
import { mergeSkills } from "../lib/skills";
import { deriveRewardSummary } from "../lib/rewards";

export type NetworkState = "loading" | "live" | "offline";

const ECONOMY_CHANNELS = ["musemoneychallenge", "museideas", "skillexchange"] as const;

function uniquePosts(posts: MusePost[]) {
  const found = new Map<number, MusePost>();
  posts.forEach((post) => found.set(post.id, post));
  return [...found.values()];
}

function flattenThread(node: ThreadNode): MusePost[] {
  return [node, ...(node.replies || []).flatMap(flattenThread)];
}

function parseTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;
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
  const [opportunities, setOpportunities] = useState<PortOpportunity[]>([]);
  const [services, setServices] = useState<PortService[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const sync = useCallback(async () => {
    setState((current) => (current === "live" ? current : "loading"));
    const localPreview =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    try {
      const [directoryResult, statsResult, taskResult, portResult, ...economyResults] =
        await Promise.allSettled([
          getMuses(),
          getStats(),
          localPreview
            ? Promise.resolve(null)
            : getPortTaskSnapshot(50),
          getLatest(PORT_CHANNEL),
          ...ECONOMY_CHANNELS.map((channel) => getLatest(channel)),
        ]);

      const directory =
        directoryResult.status === "fulfilled" ? directoryResult.value : [];
      const networkStats =
        statsResult.status === "fulfilled" ? statsResult.value : {};
      const snapshot =
        taskResult.status === "fulfilled" ? taskResult.value : null;
      const portPosts =
        portResult.status === "fulfilled" ? portResult.value : [];
      const economyPosts = economyResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );

      if (
        portResult.status === "rejected" &&
        taskResult.status === "rejected" &&
        economyResults.every((result) => result.status === "rejected")
      ) {
        throw new Error("No signed record source is reachable.");
      }

      let nextTasks = snapshot?.tasks ?? [];
      let nextWalletLinks = snapshot?.walletLinks ?? [];
      let recordPosts = [...portPosts];

      if (!snapshot) {
        const roots = portPosts.filter(
          (post) => !post.parent_post_id && parseTaskRecord(post),
        );
        const threadResults = await Promise.allSettled(
          roots.slice(0, 30).map((post) => getThread(post.id)),
        );
        nextTasks = [];
        threadResults.forEach((result, index) => {
          const root =
            result.status === "fulfilled"
              ? result.value.thread
              : (roots[index] as ThreadNode);
          recordPosts.push(...flattenThread(root));
          const task = parseTaskRecord(root);
          if (task) nextTasks.push(foldTask(task, root));
        });
        recordPosts = uniquePosts(recordPosts);
        nextWalletLinks = foldWalletLinks(recordPosts);
      }

      const opportunityRoots = economyPosts
        .filter((post) => !post.parent_post_id && parseOpportunityRecord(post))
        .slice(0, 16);
      const opportunityThreads = await Promise.allSettled(
        opportunityRoots.map((post) => getThread(post.id)),
      );
      const nextOpportunities = opportunityRoots.flatMap((post, index) => {
        const parsed = parseOpportunityRecord(post);
        if (!parsed) return [];
        const thread = opportunityThreads[index];
        return [
          thread.status === "fulfilled"
            ? foldOpportunity(parsed, thread.value.thread)
            : parsed,
        ];
      });
      const nextServices = economyPosts
        .filter((post) => !post.parent_post_id)
        .flatMap((post) => {
          const service = parseServiceRecord(post);
          return service ? [service] : [];
        });

      const nextPosts = uniquePosts([...recordPosts, ...economyPosts]).sort(
        (a, b) => parseTime(b.created_at) - parseTime(a.created_at),
      );

      setResidents(directory);
      setStats(networkStats);
      setPosts(nextPosts);
      setTasks(nextTasks);
      setWalletLinks(nextWalletLinks);
      setHumans(foldHumans(recordPosts));
      setOpportunities(nextOpportunities);
      setServices(nextServices);
      setLastSyncedAt(Date.now());
      setState("live");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(), 45_000);
    return () => window.clearInterval(timer);
  }, [sync]);

  const executions = useMemo(
    () =>
      [
        ...tasks.map(normalizePortTask),
        ...opportunities.map(normalizeOpportunity),
      ].sort((a, b) => {
        const activityA = a.completedAt || a.acceptedAt || a.createdAt;
        const activityB = b.completedAt || b.acceptedAt || b.createdAt;
        return activityB - activityA;
      }),
    [opportunities, tasks],
  );

  const executors = useMemo<Executor[]>(
    () => [
      ...humans.map((human) =>
        humanExecutor(
          human,
          humanReputation(human.actor.museId, tasks),
          tasks,
        ),
      ),
      ...services.map(serviceExecutor),
    ],
    [humans, services, tasks],
  );
  const skills = useMemo(() => mergeSkills(services), [services]);
  const rewards = useMemo(
    () => deriveRewardSummary(tasks, opportunities, services),
    [opportunities, services, tasks],
  );

  return {
    state,
    residents,
    posts,
    tasks,
    humans,
    walletLinks,
    opportunities,
    services,
    stats,
    executions,
    executors,
    skills,
    rewards,
    lastSyncedAt,
    sync,
  };
}
