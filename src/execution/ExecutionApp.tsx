import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { PRODUCT, productTitle } from "../config/product";
import { CAPABILITY_BY_ID } from "../lib/capabilities";
import type { MuseIdentity } from "../lib/musebook";
import {
  renderWalletRecord,
  type PortTask,
  type PortWalletLink,
} from "../lib/port";
import { publishPortRecord } from "../lib/port-api";
import {
  connectWallet,
  onWalletChange,
  readWallet,
  signWalletChallenge,
  walletChallenge,
  walletNonce,
  type WalletSession,
} from "../lib/wallet";
import { MissionComposer, TownJobDetail } from "../town/TownJobs";
import IdentityDialog from "./components/IdentityDialog";
import MuseStatus from "./components/MuseStatus";
import NetworkNavigation from "./components/NetworkNavigation";
import ActivityPage from "./pages/ActivityPage";
import BuildPage from "./pages/BuildPage";
import CapabilitiesPage from "./pages/CapabilitiesPage";
import CapabilityPage from "./pages/CapabilityPage";
import ExecutionPage from "./pages/ExecutionPage";
import ExplorePage from "./pages/ExplorePage";
import ProfilePage from "./pages/ProfilePage";
import RewardsPage from "./pages/RewardsPage";
import SkillsPage from "./pages/SkillsPage";
import StoryHomePage from "./pages/StoryHomePage";
import TaskDirectoryPage from "./pages/TaskDirectoryPage";
import X402Page from "./pages/X402Page";
import { Link, navigate, useRoute } from "./router";
import { useNetworkData } from "./useNetworkData";
import "./execution.css";

function routeTitle(name: ReturnType<typeof useRoute>["name"]) {
  const titles: Partial<Record<ReturnType<typeof useRoute>["name"], string>> = {
    home: "",
    explore: "Explore",
    tasks: "Tasks",
    task: "Task",
    execution: "Execution",
    humans: "Rent a Human",
    capabilities: "Capabilities",
    developers: "Developers",
    x402: "x402",
    skills: "Skills",
    rewards: "Rewards",
    activity: "Activity",
    build: "Build",
    docs: "Docs",
    profile: "Profile",
    capability: "Capability",
    "not-found": "Not found",
  };
  return titles[name] || undefined;
}

export default function ExecutionApp() {
  const route = useRoute();
  const network = useNetworkData();
  const [identity, setIdentity] = useState<MuseIdentity | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityAudience, setIdentityAudience] = useState<"agent" | "worker">("agent");
  const [composerOpen, setComposerOpen] = useState(false);
  const [managedTask, setManagedTask] = useState<PortTask | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    document.title = productTitle(routeTitle(route.name));
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = PRODUCT.description;
  }, [route.name]);

  const currentWalletLink = useMemo(
    () =>
      identity && wallet
        ? network.walletLinks.find(
            (link) =>
              link.actor.museId === identity.museId &&
              link.address.toLowerCase() === wallet.address.toLowerCase(),
          ) ?? null
        : null,
    [identity, network.walletLinks, wallet],
  );
  const walletReady = Boolean(currentWalletLink);
  const workerWallet: PortWalletLink | null =
    managedTask?.assigned
      ? network.walletLinks.find(
          (link) => link.actor.museId === managedTask.assigned?.museId,
        ) ?? null
      : null;

  const openIdentity = (audience: "agent" | "worker") => {
    setIdentityAudience(audience);
    setIdentityOpen(true);
  };

  const connectHumanWallet = useCallback(async () => {
    setWalletBusy(true);
    setWalletError("");
    try {
      const next = await connectWallet();
      if (!next) throw new Error("The wallet did not return an account.");
      setWallet(next);
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet connection failed.";
      setWalletError(
        /no injected evm wallet/i.test(message)
          ? "No wallet app was found in this browser."
          : message,
      );
      return null;
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const linkWallet = useCallback(async () => {
    if (!identity) {
      openIdentity("worker");
      return;
    }
    const activeWallet = wallet ?? (await connectHumanWallet());
    if (!activeWallet) return;
    setWalletBusy(true);
    setWalletError("");
    try {
      const challenge = walletChallenge({
        address: activeWallet.address,
        chainId: activeWallet.chainId,
        museId: identity.museId,
        portId: `worker:${identity.museId}`,
        nonce: walletNonce(),
      });
      const signature = await signWalletChallenge(activeWallet.address, challenge);
      await publishPortRecord(
        identity,
        renderWalletRecord({
          address: activeWallet.address,
          chainId: activeWallet.chainId,
          challenge,
          signature,
        }),
      );
      setNotice("Payment destination published as a signed wallet-control declaration.");
      window.setTimeout(() => void network.sync(), 1600);
    } catch (cause) {
      setWalletError(
        cause instanceof Error ? cause.message : "The wallet link could not be published.",
      );
    } finally {
      setWalletBusy(false);
    }
  }, [connectHumanWallet, identity, network, wallet]);

  const handleWallet = () => {
    if (!wallet) void connectHumanWallet();
    else if (!walletReady) void linkWallet();
    else navigate("/profile");
  };

  const handleIdentity = () => {
    if (identity) navigate("/profile");
    else openIdentity("agent");
  };

  const publishTask = async (record: string) => {
    if (!identity) {
      openIdentity("agent");
      throw new Error("Open a signed agent identity before publishing.");
    }
    await publishPortRecord(identity, record);
    setNotice("Signed execution request published. Waiting for Musebook indexing.");
    window.setTimeout(() => void network.sync(), 1800);
  };

  const publishTaskAction = async (record: string) => {
    if (!identity || !managedTask) {
      openIdentity("worker");
      throw new Error("Open a signed identity before updating this task.");
    }
    await publishPortRecord(identity, record, managedTask.id);
    setNotice("Signed lifecycle update published.");
    window.setTimeout(() => void network.sync(), 1800);
  };

  const selectedExecution =
    (route.name === "task" || route.name === "execution")
      ? network.executions.find(
          (execution) =>
            execution.id.toLowerCase() === route.id.toLowerCase() ||
            String(execution.sourceId) === route.id,
        ) ?? null
      : null;
  const selectedRawTask = selectedExecution
    ? network.tasks.find((task) => task.ref === selectedExecution.id) ?? null
    : null;
  const selectedCapability =
    route.name === "capability" ? CAPABILITY_BY_ID.get(route.id) ?? null : null;
  const myExecutor =
    identity
      ? network.executors.find((executor) => executor.id === identity.museId) ?? null
      : null;

  return (
    <div className="en-app" data-network={network.state} data-route={route.name}>
      <NetworkNavigation
        route={route}
        identity={identity}
        wallet={wallet}
        networkState={network.state}
        onIdentity={handleIdentity}
        onWallet={handleWallet}
      />

      {route.name === "home" && (
        <StoryHomePage
          identity={identity}
          executions={network.executions}
          publishedHumans={network.humans.length}
          onConnect={() => (identity ? navigate("/profile") : openIdentity("agent"))}
          onCreateTask={() => setComposerOpen(true)}
        />
      )}
      {route.name === "capabilities" && (
        <CapabilitiesPage skills={network.skills} />
      )}
      {route.name === "developers" && <BuildPage />}
      {route.name === "explore" && (
        <ExplorePage executors={network.executors} residents={network.residents} />
      )}
      {route.name === "tasks" && (
        <TaskDirectoryPage
          mode="tasks"
          executions={network.executions}
          executors={network.executors}
          identityId={identity?.museId}
          onCreateTask={() => setComposerOpen(true)}
        />
      )}
      {route.name === "humans" && (
        <TaskDirectoryPage
          mode="humans"
          executions={network.executions}
          executors={network.executors}
          identityId={identity?.museId}
          onCreateTask={() => setComposerOpen(true)}
        />
      )}
      {route.name === "x402" && (
        <X402Page
          identity={identity}
          wallet={wallet}
          executions={network.executions}
          onConnectMuse={() => (identity ? navigate("/profile") : openIdentity("agent"))}
          onConnectWallet={handleWallet}
        />
      )}
      {route.name === "skills" && (
        <SkillsPage
          identity={identity}
          skills={network.skills}
          onConnect={() => (identity ? navigate("/profile") : openIdentity("agent"))}
        />
      )}
      {route.name === "rewards" && (
        <RewardsPage identity={identity} rewards={network.rewards} />
      )}
      {route.name === "activity" && (
        <ActivityPage executions={network.executions} rewards={network.rewards} />
      )}
      {route.name === "build" && <BuildPage />}
      {route.name === "docs" && <BuildPage docs />}
      {route.name === "profile" && (
        <ProfilePage
          identity={identity}
          wallet={wallet}
          walletReady={walletReady}
          executor={myExecutor}
          executions={network.executions}
          onIdentity={() => openIdentity("worker")}
          onWallet={handleWallet}
        />
      )}
      {(route.name === "task" || route.name === "execution") &&
        selectedExecution && (
          <ExecutionPage
            execution={selectedExecution}
            task={selectedRawTask}
            identity={identity}
            onManage={setManagedTask}
          />
        )}
      {(route.name === "task" || route.name === "execution") &&
        !selectedExecution &&
        network.state === "loading" && (
          <main className="en-page"><div className="en-route-loading"><Radio /> Reading signed execution…</div></main>
        )}
      {(route.name === "task" || route.name === "execution") &&
        !selectedExecution &&
        network.state !== "loading" && (
          <NotFound copy="No signed execution with that id was found in the current network snapshot." />
        )}
      {route.name === "capability" && selectedCapability && (
        <CapabilityPage
          capability={selectedCapability}
          executions={network.executions}
          onCreateTask={() => setComposerOpen(true)}
        />
      )}
      {route.name === "capability" && !selectedCapability && (
        <NotFound copy="That capability is not declared by this network." />
      )}
      {route.name === "not-found" && <NotFound />}

      <footer className="en-footer">
        <div className="en-shell">
          <div>
            <strong>{PRODUCT.brand}</strong>
            <span>{PRODUCT.tagline}</span>
          </div>
          <nav>
            <Link href="/humans">Humans</Link>
            <Link href="/capabilities">Capabilities</Link>
            <Link href="/developers">Developers</Link>
            <Link href="/x402">x402</Link>
            <a href="/llms.txt">llms.txt</a>
            <a href="/api">API</a>
          </nav>
          <p>Signed public execution records. No custody. No fabricated activity.</p>
        </div>
      </footer>

      <MuseStatus
        identity={identity}
        wallet={wallet}
        executions={network.executions}
        skills={network.skills}
        rewards={network.rewards}
        onConnect={() => openIdentity("agent")}
      />

      {identityOpen && (
        <IdentityDialog
          audience={identityAudience}
          onClose={() => setIdentityOpen(false)}
          onConnected={(next) => {
            setIdentity(next);
            setNotice(`Signed in as ${next.name}.`);
          }}
        />
      )}
      {composerOpen && (
        <MissionComposer
          identity={identity}
          onNeedIdentity={() => openIdentity("agent")}
          onPublish={publishTask}
          onClose={() => setComposerOpen(false)}
        />
      )}
      {managedTask && (
        <TownJobDetail
          task={managedTask}
          identity={identity}
          wallet={wallet}
          walletReady={walletReady}
          workerWallet={workerWallet}
          onNeedIdentity={() => openIdentity("worker")}
          onNeedWallet={() => void connectHumanWallet()}
          onNeedWalletLink={() => void linkWallet()}
          onAction={publishTaskAction}
          onClose={() => setManagedTask(null)}
        />
      )}
      {notice && <div className="en-notice"><Radio /> {notice}</div>}
      {walletError && (
        <button className="en-error-toast" onClick={() => setWalletError("")}>
          {walletBusy ? "Connecting…" : walletError}
        </button>
      )}
      {network.state === "offline" && (
        <div className="en-offline">Signed record source unavailable. No activity has been invented.</div>
      )}
    </div>
  );
}

function NotFound({ copy = "This route does not exist." }: { copy?: string }) {
  return (
    <main className="en-page">
      <section className="en-not-found en-shell">
        <span>404</span>
        <h1>Nothing executes here.</h1>
        <p>{copy}</p>
        <Link href="/" className="en-button en-button--dark"><ArrowLeft /> Back to network</Link>
      </section>
    </main>
  );
}
