import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { PRODUCT, productTitle } from "../config/product";
import { CAPABILITY_BY_ID } from "../lib/capabilities";
import { inboxForMuse } from "../lib/inbox";
import { deriveMuseState, readStoredPublicMuse, storePublicMuse } from "../lib/muse-state";
import { getVoicePassport, type MuseVoiceState } from "../lib/muse-voice";
import type { MuseIdentity, PublicMuse } from "../lib/musebook";
import {
  renderWalletRecord,
  type PortTask,
  type PortWalletLink,
  type TaskDraft,
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
import ConnectMuseDialog from "./components/ConnectMuseDialog";
import MuseDock from "./components/MuseDock";
import NetworkNavigation from "./components/NetworkNavigation";
import SiteTour, { TourInvite, markTourSeen, tourSeen } from "./components/SiteTour";
import ActivityPage from "./pages/ActivityPage";
import AgentMissionsPage from "./pages/AgentMissionsPage";
import BuildPage from "./pages/BuildPage";
import CapabilitiesPage from "./pages/CapabilitiesPage";
import CapabilityPage from "./pages/CapabilityPage";
import ExecutionPage from "./pages/ExecutionPage";
import ExplorePage from "./pages/ExplorePage";
import FoundingMusesPage from "./pages/FoundingMusesPage";
import JoinPage from "./pages/JoinPage";
import InboxPage from "./pages/InboxPage";
import ProfilePage from "./pages/ProfilePage";
import PublicMusePage from "./pages/PublicMusePage";
import RewardsPage from "./pages/RewardsPage";
import SkillsPage from "./pages/SkillsPage";
import StudioHomePage from "./pages/StudioHomePage";
import TaskDirectoryPage from "./pages/TaskDirectoryPage";
import X402Page from "./pages/X402Page";
import { Link, navigate, useRoute } from "./router";
import { useNetworkData } from "./useNetworkData";
import "./execution.css";
import "./studio.css";
import "./founding.css";
import "./missions.css";

function routeTitle(name: ReturnType<typeof useRoute>["name"]) {
  const titles: Partial<Record<ReturnType<typeof useRoute>["name"], string>> = {
    home: "",
    explore: "Explore",
    tasks: "Tasks",
    task: "Task",
    execution: "Execution",
    humans: "Humans",
    join: "Get paid",
    capabilities: "Powers",
    developers: "Connect a Muse",
    x402: "Settlement",
    skills: "Skills",
    rewards: "Rewards",
    muses: "First 100 Working Muses",
    missions: "Agent Missions",
    inbox: "Inbox",
    "muse-profile": "Muse Profile",
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
  const [publicMuse, setPublicMuse] = useState<PublicMuse | null>(() => readStoredPublicMuse());
  const [voice, setVoice] = useState<MuseVoiceState>({ status: "idle" });
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityMode, setIdentityMode] = useState<"create" | "export" | undefined>(undefined);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState<Partial<TaskDraft> | undefined>(undefined);
  const [managedTask, setManagedTask] = useState<PortTask | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [notice, setNotice] = useState("");
  const [tourStep, setTourStep] = useState<number | null>(() =>
    new URLSearchParams(window.location.search).get("tour") === "1" ? 0 : null,
  );
  const [tourInvite, setTourInvite] = useState(false);

  useEffect(() => {
    const refresh = () => void readWallet().then(setWallet).catch(() => setWallet(null));
    refresh();
    return onWalletChange(refresh);
  }, []);

  // Offer the tour once, on the homepage, after the studio has settled.
  useEffect(() => {
    if (route.name !== "home" || tourStep !== null || tourSeen()) return;
    const timer = window.setTimeout(() => setTourInvite(true), 1600);
    return () => window.clearTimeout(timer);
  }, [route.name, tourStep]);

  const startTour = useCallback(() => {
    setTourInvite(false);
    setIdentityOpen(false);
    setComposerOpen(false);
    setTourStep(0);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Read the signed MuseVoice passport for whichever Muse is connected.
  const connectedMuseId = identity?.museId ?? publicMuse?.museId ?? null;
  useEffect(() => {
    if (!connectedMuseId) {
      setVoice({ status: "idle" });
      return;
    }
    let cancelled = false;
    setVoice({ status: "loading" });
    void getVoicePassport(connectedMuseId).then((next) => {
      if (!cancelled) setVoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, [connectedMuseId]);

  const museState = useMemo(
    () =>
      deriveMuseState({
        identity,
        publicMuse,
        executions: network.executions,
        skills: network.skills,
        voice,
        walletConnected: Boolean(wallet),
      }),
    [identity, publicMuse, network.executions, network.skills, voice, wallet],
  );
  const inboxCount = useMemo(
    () => inboxForMuse(identity?.museId ?? "", network.tasks).filter((item) => item.priority === "action").length,
    [identity?.museId, network.tasks],
  );

  const openComposer = useCallback((draft?: Partial<TaskDraft>) => {
    setComposerDraft(draft);
    setComposerOpen(true);
  }, []);

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

  const openIdentity = (_audience?: "agent" | "worker", mode?: "create" | "export") => {
    setIdentityMode(mode);
    setIdentityOpen(true);
  };

  const publishHumanDeclaration = async (record: string) => {
    if (!identity) throw new Error("Create or unlock an identity before publishing.");
    const result = await publishPortRecord(identity, record);
    setNotice("Availability declaration recorded in the ledger.");
    window.setTimeout(() => void network.sync(), 600);
    return result;
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
    else openIdentity();
  };

  const publishTask = async (record: string) => {
    if (!identity) {
      openIdentity("agent");
      throw new Error("Open a signed agent identity before publishing.");
    }
    await publishPortRecord(identity, record);
    setNotice("Signed execution request recorded in the ledger.");
    window.setTimeout(() => void network.sync(), 1800);
  };

  const publishTaskAction = async (record: string) => {
    if (!identity || !managedTask) {
      openIdentity("worker");
      throw new Error("Open a signed identity before updating this task.");
    }
    await publishPortRecord(identity, record, managedTask.id);
    setNotice("Signed lifecycle update recorded in the ledger.");
    window.setTimeout(() => void network.sync(), 1800);
  };

  const publishFoundingRecord = async (record: string) => {
    if (!identity) {
      openIdentity("agent", "create");
      throw new Error("Create or unlock a Muse identity before signing.");
    }
    const result = await publishPortRecord(identity, record);
    setNotice(
      record.startsWith("[port.muse")
        ? "Founding profile recorded in the public ledger."
        : record.startsWith("[port.reward")
          ? "Verified payout and signed award recorded in the public ledger."
          : "Contribution claim recorded in the public ledger.",
    );
    await network.sync();
    return result;
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
    <div className="en-app ms-app" data-network={network.state} data-route={route.name}>
      <NetworkNavigation
        route={route}
        muse={museState.muse}
        wallet={wallet}
        onIdentity={handleIdentity}
        onWallet={handleWallet}
        onTour={startTour}
        inboxCount={inboxCount}
      />

      {route.name === "home" && (
        <StudioHomePage
          museState={museState}
          executions={network.executions}
          skills={network.skills}
          networkState={network.state}
          publishedHumans={network.humans.length}
          foundingCount={network.founding?.foundingCount ?? network.muses.length}
          onConnect={() => openIdentity()}
          onPublish={(draft) => {
            if (!identity) {
              setComposerDraft(draft);
              openIdentity();
              return;
            }
            openComposer(draft);
          }}
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
      {route.name === "join" && (
        <JoinPage
          identity={identity}
          existing={identity ? network.humans.find((human) => human.actor.museId === identity.museId) ?? null : null}
          openRequests={network.executions.filter((execution) => execution.executorType === "human" && ["CREATED", "MATCHING"].includes(execution.status)).length}
          onNeedIdentity={() => openIdentity("worker", "create")}
          onPublish={publishHumanDeclaration}
          onExportKey={() => openIdentity("worker", "export")}
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
        <RewardsPage
          identity={identity}
          wallet={wallet}
          walletLinks={network.walletLinks}
          contributions={network.contributions}
          rewards={network.rewards}
          founding={network.founding}
          pons={network.pons}
          onConnectWallet={handleWallet}
          onPublish={publishFoundingRecord}
          onRefresh={network.sync}
        />
      )}
      {route.name === "muses" && (
        <FoundingMusesPage
          identity={identity}
          campaign={network.founding}
          onNeedIdentity={() => openIdentity("agent", "create")}
          onPublish={publishFoundingRecord}
        />
      )}
      {route.name === "missions" && (
        <AgentMissionsPage
          identity={identity}
          muses={network.muses}
          contributions={network.contributions}
          tasks={network.tasks}
          founding={network.founding}
          onNeedIdentity={() => openIdentity("agent", "create")}
          onPublish={publishFoundingRecord}
          onCreateMission={(draft) =>
            openComposer({
              executor: "agent",
              category: "OTHER",
              city: "",
              asset: "META",
              proof: [{ type: "OUTPUT", description: "" }],
              ...draft,
            })
          }
          onManageMission={setManagedTask}
        />
      )}
      {route.name === "inbox" && (
        <InboxPage
          identity={identity}
          tasks={network.tasks}
          onConnect={() => openIdentity("agent")}
          onOpen={setManagedTask}
        />
      )}
      {route.name === "muse-profile" && (
        <PublicMusePage
          id={route.id}
          muses={network.muses}
          tasks={network.tasks}
          contributions={network.contributions}
          rewards={network.signedRewards}
        />
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
            <Link href="/capabilities">Powers</Link>
            <Link href="/humans">Humans</Link>
            <Link href="/activity">Proof</Link>
            <Link href="/muses">First 100 Muses</Link>
            <Link href="/missions">Agent Missions</Link>
            <Link href="/developers">Connect a Muse</Link>
            <Link href="/x402">Settlement</Link>
            <a href="/.well-known/musetools-connector.json">Connector</a>
            <a href="/llms.txt">llms.txt</a>
            <a href="/api">API</a>
            <a href={PRODUCT.xUrl} target="_blank" rel="noreferrer">X</a>
            <button type="button" className="en-footer__tour" onClick={startTour}>Tour</button>
          </nav>
          <p>Signed public execution records. No custody. No fabricated activity. Not affiliated with Meta.</p>
        </div>
      </footer>

      {!["home", "muses", "missions"].includes(route.name) && (
        <MuseDock
          state={museState}
          onConnect={() => openIdentity()}
          onGive={() => navigate("/")}
        />
      )}

      {identityOpen && (
        <ConnectMuseDialog
          identity={identity}
          initialMode={identityMode}
          onClose={() => {
            setIdentityOpen(false);
            setIdentityMode(undefined);
          }}
          onIdentity={(next) => {
            setIdentity(next);
            setNotice(`${next.name} connected. Signer unlocked on this device.`);
            // A pending draft from the studio continues once a signer exists.
            if (composerDraft) setComposerOpen(true);
          }}
          onPublicMuse={(profile) => {
            setPublicMuse(profile);
            storePublicMuse(profile);
            setNotice(`Following ${profile.name}. Read-only until its signer is unlocked.`);
          }}
        />
      )}
      {composerOpen && (
        <MissionComposer
          key={JSON.stringify(composerDraft ?? {})}
          identity={identity}
          initialDraft={composerDraft}
          onNeedIdentity={() => openIdentity()}
          onPublish={publishTask}
          onClose={() => {
            setComposerOpen(false);
            setComposerDraft(undefined);
          }}
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
      {tourInvite && tourStep === null && (
        <TourInvite
          onStart={startTour}
          onDismiss={() => {
            markTourSeen();
            setTourInvite(false);
          }}
        />
      )}
      {tourStep !== null && (
        <SiteTour
          step={tourStep}
          onStep={setTourStep}
          onClose={() => setTourStep(null)}
        />
      )}
      {notice && <div className="en-notice"><Radio /> {notice}</div>}
      {walletError && (
        <button className="en-error-toast" onClick={() => setWalletError("")}>
          {walletBusy ? "Connecting…" : walletError}
        </button>
      )}
      {network.state === "offline" && (
        <div className="en-offline">The MuseTools ledger is unreachable. No activity has been invented.</div>
      )}
      {network.state === "unconfigured" && (
        <div className="en-offline">This deployment has no ledger database yet. Set DATABASE_URL to bring records online.</div>
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
