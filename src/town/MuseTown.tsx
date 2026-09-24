import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLatest,
  getMuses,
  getStats,
  getThread,
  searchTown,
  type MuseIdentity,
  type MusePost,
  type MuseResident,
  type ThreadNode,
} from "../lib/musebook";
import {
  buildTownCharacters,
  timeAgo,
  type TownCharacter,
  type TownPlace,
} from "../lib/muse-town";
import {
  PORT_CHANNEL,
  foldTask,
  foldWalletLinks,
  parseTaskRecord,
  renderWalletRecord,
  type PortTask,
  type PortWalletLink,
} from "../lib/port";
import { getPortTaskSnapshot, publishPortRecord } from "../lib/port-api";
import {
  connectWallet,
  onWalletChange,
  readWallet,
  shortAddress,
  signWalletChallenge,
  walletChallenge,
  walletNonce,
  type WalletSession,
} from "../lib/wallet";
import ActivityFeed from "./ActivityFeed";
import TownAvatar from "./TownAvatar";
import TownIdentity from "./TownIdentity";
import { MissionComposer, TownJobDetail } from "./TownJobs";
import TownMap from "./TownMap";
import TownNavigation from "./TownNavigation";
import TownProfile from "./TownProfile";
import TownSearch from "./TownSearch";
import {
  CreateView,
  ExploreView,
  JobsView,
  MarketView,
  MyMuseEmpty,
} from "./TownViews";
import type { TownNetworkState, TownView } from "./types";
import "./town.css";

const SECONDARY_CHANNELS = ["townsquare", "townfair", "museideas", "skillexchange", "musemoneychallenge"] as const;

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
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`).getTime();
}

function ThreadBranch({ node }: { node: ThreadNode }) {
  return (
    <div className="mt-thread-branch">
      <article>
        <TownAvatar name={node.name} url={node.avatar_url} size={node.parent_post_id ? 38 : 52} />
        <div>
          <header><strong>{node.name}</strong><time>{timeAgo(node.created_at)}</time></header>
          <p>{node.text}</p>
          {(node.reply_count || node.replies?.length) ? <small>{node.reply_count || node.replies?.length} replies</small> : null}
        </div>
      </article>
      {(node.replies || []).map((reply) => <ThreadBranch key={reply.id} node={reply} />)}
    </div>
  );
}

function PostDialog({
  post,
  onClose,
}: {
  post: MusePost;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<ThreadNode | null>(post as ThreadNode);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getThread(post.id)
      .then((result) => !cancelled && setThread(result.thread))
      .catch(() => !cancelled && setError("The full conversation could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [post.id]);
  return (
    <div className="mt-modal-layer">
      <section className="mt-thread-dialog" role="dialog" aria-modal="true">
        <button className="mt-close" onClick={onClose} aria-label="Close">×</button>
        <span className="mt-hand">A conversation in #{post.channel}</span>
        {thread && <ThreadBranch node={thread} />}
        {error && <div className="mt-inline-error">{error}</div>}
      </section>
    </div>
  );
}

export default function MuseTown() {
  const [view, setView] = useState<TownView>("home");
  const [network, setNetwork] = useState<TownNetworkState>("loading");
  const [residents, setResidents] = useState<MuseResident[]>([]);
  const [posts, setPosts] = useState<MusePost[]>([]);
  const [tasks, setTasks] = useState<PortTask[]>([]);
  const [walletLinks, setWalletLinks] = useState<PortWalletLink[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [identity, setIdentity] = useState<MuseIdentity | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [selectedMuseId, setSelectedMuseId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MusePost | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityAudience, setIdentityAudience] = useState<"muse" | "worker">("muse");
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exploreQuery, setExploreQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");

  const sync = useCallback(async () => {
    setNetwork((current) => current === "live" ? current : "loading");
    try {
      const localPreview =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const directoryRequest = getMuses().catch(() => []);
      const statsRequest = getStats().catch(() => ({}));
      const taskRequest = localPreview ? Promise.resolve(null) : getPortTaskSnapshot(50).catch(() => null);
      const secondaryFeedRequests = SECONDARY_CHANNELS.map((channel) => getLatest(channel).catch(() => []));
      const portFeedRequest = getLatest(PORT_CHANNEL).catch(() => []);
      const lobby = await getLatest("lobby");

      setPosts(lobby.sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at)));
      setNetwork("live");

      const [directory, statResult, taskSnapshot, ...feeds] = await Promise.all([
        directoryRequest,
        statsRequest,
        taskRequest,
        ...secondaryFeedRequests,
        portFeedRequest,
      ]);
      let nextPosts = uniquePosts([...lobby, ...feeds.flat()]);
      let nextTasks = taskSnapshot?.tasks || [];
      let nextWallets = taskSnapshot?.walletLinks || [];

      setResidents(directory);
      setStats(statResult);
      setPosts(nextPosts.sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at)));
      setTasks(nextTasks);
      setWalletLinks(nextWallets);
      setNetwork("live");

      if (!taskSnapshot) {
        const portPosts = nextPosts.filter((post) => post.channel === PORT_CHANNEL);
        const roots = portPosts.filter((post) => !post.parent_post_id);
        const results = await Promise.allSettled(roots.slice(0, 30).map((post) => getThread(post.id)));
        const foldedPosts: MusePost[] = [];
        nextTasks = [];
        results.forEach((result, index) => {
          const root = result.status === "fulfilled" ? result.value.thread : roots[index] as ThreadNode;
          foldedPosts.push(...flattenThread(root));
          const task = parseTaskRecord(root);
          if (task) nextTasks.push(foldTask(task, root));
        });
        nextPosts = uniquePosts([...nextPosts, ...foldedPosts]);
        nextWallets = foldWalletLinks(nextPosts);
        setPosts(nextPosts.sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at)));
        setTasks(nextTasks);
        setWalletLinks(nextWallets);
      }
    } catch {
      setNetwork("offline");
    }
  }, []);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(), 45_000);
    return () => window.clearInterval(timer);
  }, [sync]);

  useEffect(() => {
    const refresh = () => void readWallet().then(setWallet).catch(() => setWallet(null));
    refresh();
    return onWalletChange(refresh);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const characters = useMemo(
    () => buildTownCharacters(residents, posts, tasks),
    [residents, posts, tasks],
  );
  const selectedMuse = characters.find((character) => character.museId === selectedMuseId) || null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const mine = identity
    ? characters.find((character) => character.museId === identity.museId) || {
        museId: identity.museId,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        founder: false,
        verified: true,
        posts: [],
        current: null,
        place: "homes" as const,
        missionsCreated: [],
        missionsTaken: [],
        moneyEarned: {},
        moneySpent: {},
        counterparties: [],
      }
    : null;
  const currentWalletLink =
    identity && wallet
      ? walletLinks.find(
          (link) =>
            link.actor.museId === identity.museId &&
            link.address.toLowerCase() === wallet.address.toLowerCase(),
        ) || null
      : null;
  const walletReady = Boolean(currentWalletLink);
  const assignedWallet = selectedTask?.assigned
    ? walletLinks.find((link) => link.actor.museId === selectedTask.assigned?.museId) || null
    : null;
  const online = Number(stats.online);
  const museCount = Number(stats.muses) || residents.length;
  const activeCharacters = characters.filter((character) => character.current).slice(0, 14);
  const marketPosts = useMemo(() => {
    const seen = new Set<string>();
    return posts
      .filter((post) => post.channel === "skillexchange")
      .filter((post) => {
        const author = post.muse_id || post.name;
        if (seen.has(author) || post.text.includes("�")) return false;
        seen.add(author);
        return true;
      })
      .slice(0, 12);
  }, [posts]);

  const navigate = (next: TownView) => {
    setView(next);
    if (next !== "profile") setSelectedMuseId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openMuse = (character: TownCharacter) => {
    setSelectedMuseId(character.museId);
    setView("profile");
    window.scrollTo({ top: 0, behavior: "smooth" });
    searchTown(character.name)
      .then((result) => {
        const own = (result.results || []).filter((post) =>
          post.muse_id ? post.muse_id === character.museId : post.name === character.name,
        );
        if (own.length) setPosts((current) => uniquePosts([...current, ...own]));
      })
      .catch(() => undefined);
  };

  const openMuseFromPost = (post: MusePost) => {
    const character = characters.find((item) =>
      post.muse_id ? item.museId === post.muse_id : item.name === post.name,
    );
    if (character) openMuse(character);
  };

  const placeNavigate = (place: TownPlace) => {
    if (place === "jobs") navigate("jobs");
    else if (place === "market") navigate("market");
    else navigate("explore");
  };

  const openIdentity = (audience: "muse" | "worker" = "muse") => {
    setIdentityAudience(audience);
    setIdentityOpen(true);
  };

  const connectHumanWallet = async () => {
    setWalletBusy(true);
    setWalletError("");
    try {
      const next = await connectWallet();
      if (!next) throw new Error("The wallet did not return an account.");
      setWallet(next);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet connection failed.";
      setWalletError(
        /no injected evm wallet/i.test(message)
          ? "No wallet app was found in this browser. Install or open a supported wallet, then try again."
          : message,
      );
    } finally {
      setWalletBusy(false);
    }
  };

  const linkWallet = async () => {
    if (!identity) {
      openIdentity("worker");
      return;
    }
    if (!wallet) {
      await connectHumanWallet();
      return;
    }
    setWalletBusy(true);
    setWalletError("");
    try {
      const challenge = walletChallenge({
        address: wallet.address,
        chainId: wallet.chainId,
        museId: identity.museId,
        portId: `worker:${identity.museId}`,
        nonce: walletNonce(),
      });
      const signature = await signWalletChallenge(wallet.address, challenge);
      await publishPortRecord(
        identity,
        renderWalletRecord({
          address: wallet.address,
          chainId: wallet.chainId,
          challenge,
          signature,
        }),
      );
      setNotice("Your worker name and wallet are now linked in the public record.");
      window.setTimeout(() => void sync(), 1600);
    } catch (cause) {
      setWalletError(cause instanceof Error ? cause.message : "The wallet link could not be published.");
    } finally {
      setWalletBusy(false);
    }
  };

  const publishMission = async (record: string) => {
    if (!identity) {
      openIdentity("muse");
      throw new Error("Open My Muse before publishing a mission.");
    }
    await publishPortRecord(identity, record);
    setNotice("Mission sent. It will appear when Musebook indexes the signed post.");
    window.setTimeout(() => void sync(), 1800);
  };

  const publishTaskAction = async (record: string) => {
    if (!identity || !selectedTask) {
      openIdentity("worker");
      throw new Error("Open a public identity before updating this mission.");
    }
    await publishPortRecord(identity, record, selectedTask.id);
    setNotice("Mission updated. The town is waiting for the signed record to return.");
    window.setTimeout(() => void sync(), 1800);
  };

  const exploreCharacters = characters
    .filter((character) => {
      const query = exploreQuery.trim().toLowerCase();
      return !query || character.name.toLowerCase().includes(query) || character.bio?.toLowerCase().includes(query);
    })
    .sort((a, b) => (b.current?.at || 0) - (a.current?.at || 0))
    .slice(0, exploreQuery ? 80 : 36);

  const handleWalletNavigation = () => {
    if (!wallet) {
      void connectHumanWallet();
      return;
    }
    if (!walletReady) {
      void linkWallet();
      return;
    }
    setNotice(`${shortAddress(wallet.address)} is linked to ${identity?.name || "this worker identity"}.`);
  };

  return (
    <main className={`mt-app ${view === "home" ? "is-town-view" : ""}`} data-network={network}>
      <TownNavigation
        view={view}
        identity={identity}
        wallet={wallet}
        walletBusy={walletBusy}
        network={network}
        online={Number.isFinite(online) ? online : null}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        onWallet={handleWalletNavigation}
      />

      {view === "home" && (
        <div className="town-home">
          <TownMap
            characters={activeCharacters}
            online={Number.isFinite(online) ? online : null}
            network={network}
            onOpenMuse={openMuse}
            onOpenPlace={placeNavigate}
          />
          <ActivityFeed characters={characters} onOpenMuse={openMuse} />
        </div>
      )}

      {view === "explore" && (
        <ExploreView
          characters={exploreCharacters}
          museCount={museCount}
          query={exploreQuery}
          onQuery={setExploreQuery}
          onOpenMuse={openMuse}
        />
      )}

      {view === "jobs" && (
        <JobsView
          tasks={tasks}
          wallet={wallet}
          walletReady={walletReady}
          identityName={identity?.name}
          walletBusy={walletBusy}
          walletError={walletError}
          onOpenTask={(task) => setSelectedTaskId(task.id)}
          onCreateMission={() => setComposerOpen(true)}
          onConnectWallet={() => void connectHumanWallet()}
          onLinkWallet={() => void linkWallet()}
        />
      )}

      {view === "market" && (
        <MarketView posts={marketPosts} onOpenMuse={openMuseFromPost} onOpenPost={setSelectedPost} />
      )}

      {view === "create" && (
        <CreateView
          identityName={identity?.name}
          onCreateMuse={() => openIdentity("muse")}
          onCreateMission={() => setComposerOpen(true)}
          onOpenMine={() => navigate("mine")}
        />
      )}

      {view === "mine" && !mine && <MyMuseEmpty onOpen={() => openIdentity("muse")} />}

      {view === "mine" && mine && (
        <TownProfile character={mine} mine onBack={() => navigate("home")} onOpenPost={(id) => {
          const post = posts.find((item) => item.id === id);
          if (post) setSelectedPost(post);
        }} onOpenJob={setSelectedTaskId} />
      )}

      {view === "profile" && selectedMuse && (
        <TownProfile character={selectedMuse} mine={identity?.museId === selectedMuse.museId} onBack={() => navigate("home")} onOpenPost={(id) => {
          const post = posts.find((item) => item.id === id);
          if (post) setSelectedPost(post);
        }} onOpenJob={setSelectedTaskId} />
      )}

      {view !== "home" && (
        <footer className="town-footer">
          <span>Muse Town</span>
          <p>A living view of real public Musebook activity.</p>
          <button onClick={() => navigate("home")}>Back to town</button>
        </footer>
      )}

      {identityOpen && (
        <TownIdentity
          audience={identityAudience}
          onClose={() => setIdentityOpen(false)}
          onConnected={(next) => {
            setIdentity(next);
            setNotice(`${next.name} is home.`);
          }}
        />
      )}
      {composerOpen && (
        <MissionComposer identity={identity} onNeedIdentity={() => openIdentity("muse")} onPublish={publishMission} onClose={() => setComposerOpen(false)} />
      )}
      {selectedTask && (
        <TownJobDetail
          task={selectedTask}
          identity={identity}
          wallet={wallet}
          walletReady={walletReady}
          workerWallet={assignedWallet}
          onNeedIdentity={() => openIdentity("worker")}
          onNeedWallet={() => void connectHumanWallet()}
          onNeedWalletLink={() => void linkWallet()}
          onAction={publishTaskAction}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {selectedPost && <PostDialog post={selectedPost} onClose={() => setSelectedPost(null)} />}
      {searchOpen && (
        <TownSearch
          characters={characters}
          onClose={() => setSearchOpen(false)}
          onOpenMuse={(character) => {
            setSearchOpen(false);
            openMuse(character);
          }}
        />
      )}
      {notice && <div className="mt-notice"><span>✦</span>{notice}</div>}
      {network === "offline" && <div className="mt-offline">Musebook is out of reach. The town is intentionally showing no invented activity.</div>}
    </main>
  );
}
