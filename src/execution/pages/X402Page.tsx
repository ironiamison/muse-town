import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Code2,
  KeyRound,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { WalletSession } from "../../lib/wallet";
import type { Execution } from "../../lib/execution";
import MuseCore from "../components/MuseCore";
import PaymentFlow, { type PaymentFlowState } from "../components/PaymentFlow";
import { Link } from "../router";

const flowStates: PaymentFlowState[] = ["need", "quote", "paying", "executing", "complete"];

export default function X402Page({
  identity,
  wallet,
  executions,
  onConnectMuse,
  onConnectWallet,
}: {
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  executions: Execution[];
  onConnectMuse: () => void;
  onConnectWallet: () => void;
}) {
  const [stateIndex, setStateIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStateIndex((current) => (current + 1) % flowStates.length),
      1900,
    );
    return () => window.clearInterval(timer);
  }, []);
  const signedPayments = executions.filter(
    (execution) => execution.payment.status === "DECLARED_PAID",
  );

  return (
    <main className="en-page x402-page">
      <section className="x402-hero">
        <div className="en-shell x402-hero__layout">
          <div className="x402-hero__copy">
            <span className="en-eyebrow"><CircleDollarSign /> Muse purchasing power</span>
            <h1>Give it money.</h1>
            <p>Let your Muse pay for what it needs.</p>
            <div className="en-hero__actions">
              <button className="en-button en-button--primary" onClick={identity ? onConnectWallet : onConnectMuse}>
                {!identity ? "Connect your Muse" : wallet ? "Payment wallet connected" : "Connect payment rail"}
                <ArrowRight />
              </button>
              <Link href="/docs#payments" className="en-button en-button--secondary">Read integration docs</Link>
            </div>
            <div className="x402-hero__truth">
              <ShieldCheck />
              <span><strong>Architecture ready. Settlement not configured.</strong><small>No x402 transaction is executed or implied by this interface.</small></span>
            </div>
          </div>
          <MuseCore
            identity={identity}
            active="x402"
            actionLabel={flowStates[stateIndex] === "complete" ? "Paid capability executed" : "Purchasing capability"}
            resultLabel={flowStates[stateIndex] === "complete" ? "Result returned" : "Payment flow active"}
            onConnect={onConnectMuse}
            compact
          />
        </div>
      </section>

      <section className="x402-live en-shell">
        <header className="en-section-heading">
          <span className="en-eyebrow">Need → pay → execute → result</span>
          <h2>Machine commerce, without the plumbing in your face.</h2>
          <p>A Muse discovers a priced capability, authorizes exactly what it needs, and continues when the result returns.</p>
        </header>
        <PaymentFlow
          state={flowStates[stateIndex]}
          need="Image generation"
          amount={0.08}
          currency="USD"
          service="Image service"
          duration="1.2 sec"
          illustrative
        />
      </section>

      <section className="x402-resources">
        <div className="en-shell">
          <header className="en-section-heading">
            <span className="en-eyebrow">One payment surface</span>
            <h2>What a Muse can pay for.</h2>
          </header>
          <div className="x402-resource-lines">
            <div><span>Humans</span><strong>Physical execution</strong><em>Variable budget</em></div>
            <div><span>Skills</span><strong>Callable abilities</strong><em>Per call or quote</em></div>
            <div><span>APIs</span><strong>Machine resources</strong><em>Fixed price</em></div>
            <div><span>Services</span><strong>Specialized outcomes</strong><em>Provider terms</em></div>
          </div>
        </div>
      </section>

      <section className="x402-implementation en-shell">
        <div>
          <span className="en-eyebrow"><Code2 /> Integration boundary</span>
          <h2>x402 fits fixed-price machine resources.</h2>
          <p>
            The current task system has variable budgets, expenses, proof review, and disputes. x402 should therefore be an isolated adapter for fixed-price skills and services—not a fake replacement for the human settlement lifecycle.
          </p>
          <Link href="/build#payments" className="en-inline-link">Open payment architecture <ArrowRight /></Link>
        </div>
        <ol>
          <li className="complete"><Check /><span><strong>Payment interface</strong><small>Rail-neutral payment status and signed settlement claims</small></span></li>
          <li className="complete"><Check /><span><strong>Wallet declarations</strong><small>Executor-controlled payment destinations</small></span></li>
          <li><KeyRound /><span><strong>Configure payee + facilitator</strong><small>No provider or chain selected</small></span></li>
          <li><ShieldCheck /><span><strong>Reconciliation policy</strong><small>Required before settlement can be trusted</small></span></li>
        </ol>
      </section>

      <section className="x402-existing en-shell">
        <header className="en-section-heading en-section-heading--row">
          <div>
            <span className="en-eyebrow"><WalletCards /> Current payment records</span>
            <h2>Signed claims, clearly labeled.</h2>
          </div>
          <span className="x402-existing__count">{signedPayments.length} in current snapshot</span>
        </header>
        <div className="x402-payment-records">
          {signedPayments.map((execution) => (
            <Link href={`/executions/${execution.id}`} key={`${execution.source}-${execution.id}`}>
              <span><strong>{execution.title}</strong><small>{execution.id} · creator-signed external claim</small></span>
              <em>{execution.payment.amount ?? "—"} {execution.payment.currency}</em>
              <ArrowRight />
            </Link>
          ))}
          {!signedPayments.length && (
            <div className="en-directory-empty">
              <WalletCards />
              <h3>No signed payment claims loaded.</h3>
              <p>This page will not manufacture transactions to look active.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
