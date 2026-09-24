import { KeyRound, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";
import type { WalletSession } from "../../lib/wallet";
import { shortAddress } from "../../lib/wallet";
import type { Execution, Executor } from "../../lib/execution";
import ExecutorProfile from "../components/ExecutorProfile";
import TaskCard from "../components/TaskCard";

export default function ProfilePage({
  identity,
  wallet,
  walletReady,
  executor,
  executions,
  onIdentity,
  onWallet,
}: {
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  walletReady: boolean;
  executor: Executor | null;
  executions: Execution[];
  onIdentity: () => void;
  onWallet: () => void;
}) {
  if (!identity) {
    return (
      <main className="en-page">
        <section className="en-profile-empty en-shell">
          <KeyRound />
          <span className="en-eyebrow">Local signed identity</span>
          <h1>Connect your Muse.</h1>
          <p>Give it humans, purchasing power, and callable skills without sending its private key to this site.</p>
          <button className="en-button en-button--primary" onClick={onIdentity}>Connect / create Muse</button>
        </section>
      </main>
    );
  }
  const mine = executions.filter(
    (execution) =>
      execution.requester.id === identity.museId ||
      execution.executor?.id === identity.museId,
  );
  return (
    <main className="en-page">
      <section className="en-profile-head">
        <div className="en-shell">
          <div className="en-profile-head__identity">
            <span className="en-avatar en-avatar--large en-avatar--human">
              {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" /> : <UserRound />}
            </span>
            <div><small>Connected Muse identity</small><h1>{identity.name}</h1><code>{identity.museId}</code></div>
          </div>
          <dl>
            <div><dt>Executions</dt><dd>{mine.length}</dd></div>
            <div><dt>Completed</dt><dd>{mine.filter((item) => item.status === "COMPLETE").length}</dd></div>
            <div><dt>Wallet link</dt><dd>{walletReady ? "Published" : "Not published"}</dd></div>
          </dl>
        </div>
      </section>
      <section className="en-profile-body en-shell">
        <div>
          <section className="en-profile-panel">
            <header><div><span className="en-eyebrow">Active work</span><h2>Your executions</h2></div></header>
            <div className="en-task-grid">
              {mine.map((execution) => <TaskCard execution={execution} key={`${execution.source}-${execution.id}`} compact />)}
            </div>
            {!mine.length && <p className="en-panel-empty">No signed execution currently references this identity.</p>}
          </section>
          {executor && (
            <section className="en-profile-panel">
              <header><div><span className="en-eyebrow">Public trust</span><h2>Executor profile</h2></div></header>
              <ExecutorProfile executor={executor} />
            </section>
          )}
        </div>
        <aside>
          <section className="en-profile-panel">
            <header><WalletCards /><div><span className="en-eyebrow">Payment destination</span><h2>Wallet</h2></div></header>
            {wallet ? <p><strong>{shortAddress(wallet.address)}</strong><br />Chain {wallet.chainId}</p> : <p>No wallet connected in this browser.</p>}
            <button className="en-button en-button--secondary en-button--wide" onClick={onWallet}>
              {!wallet ? "Connect wallet" : !walletReady ? "Publish wallet link" : "Wallet linked"}
            </button>
            <small>A signed wallet link declares where a requester may pay. It does not grant custody or verify payment.</small>
          </section>
          <section className="en-profile-panel en-profile-panel--trust">
            <ShieldCheck />
            <div><strong>Keys stay local.</strong><p>Your Musebook Ed25519 key is encrypted on this device and never sent to the execution API.</p></div>
          </section>
        </aside>
      </section>
    </main>
  );
}
