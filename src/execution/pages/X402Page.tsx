import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Code2,
  Globe2,
  KeyRound,
  LoaderCircle,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { WalletSession } from "../../lib/wallet";
import type { Execution } from "../../lib/execution";
import {
  inspectX402,
  offersForCurrentWallet,
  payX402,
  X402_MAX_PER_PAYMENT,
  X402_NETWORK_FAMILIES,
  type X402Inspection,
  type X402PaidResult,
} from "../../lib/x402-client";
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
  const [resourceUrl, setResourceUrl] = useState("");
  const [inspection, setInspection] = useState<X402Inspection | null>(null);
  const [result, setResult] = useState<X402PaidResult | null>(null);
  const [busy, setBusy] = useState<"inspect" | "pay" | "">("");
  const [error, setError] = useState("");
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
  const offers = inspection ? offersForCurrentWallet(inspection, wallet) : { payable: [], other: [] };

  const inspect = async () => {
    setBusy("inspect");
    setError("");
    setInspection(null);
    setResult(null);
    try {
      setInspection(await inspectX402(resourceUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The endpoint could not be inspected.");
    } finally {
      setBusy("");
    }
  };

  const pay = async () => {
    if (!wallet) {
      onConnectWallet();
      return;
    }
    if (!offers.payable.length) {
      setError("Switch the connected wallet to one of the EVM networks offered by this resource, then inspect it again.");
      return;
    }
    setBusy("pay");
    setError("");
    setResult(null);
    try {
      setResult(await payX402(resourceUrl, wallet));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The x402 payment could not be completed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="en-page x402-page">
      <section className="x402-hero">
        <div className="en-shell x402-hero__layout">
          <div className="x402-hero__copy">
            <span className="en-eyebrow"><CircleDollarSign /> PAY · settlement infrastructure</span>
            <h1>Settle with the one who acted.</h1>
            <p>Muses can now inspect an x402 endpoint, choose a compatible offer, and pay the provider directly from a connected wallet. MuseTools receives nothing and holds no keys.</p>
            <div className="en-hero__actions">
              <button className="en-button en-button--primary" onClick={identity ? onConnectWallet : onConnectMuse}>
                {!identity ? "Connect your Muse" : wallet ? "Payment wallet connected" : "Connect payment rail"}
                <ArrowRight />
              </button>
              <Link href="/docs#payments" className="en-button en-button--secondary">Read integration docs</Link>
            </div>
            <div className="x402-hero__truth">
              <ShieldCheck />
              <span><strong>x402 buyer rail live.</strong><small>EVM exact payments · active wallet network only · default assets · {X402_MAX_PER_PAYMENT} hard cap per payment.</small></span>
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

      <section className="ms-x402-call ms-shell">
        <header className="en-section-heading">
          <span className="en-eyebrow"><Globe2 /> Live x402 client</span>
          <h2>Check a provider before you pay.</h2>
          <p>Paste an x402 resource to see its price, payee, and supported network. Checking never signs or spends. Payment still requires your wallet approval.</p>
        </header>
        <div className="ms-x402-call__grid">
          <div className="ms-x402-console">
            <label className="ms-field">
              <span>x402 provider endpoint</span>
              <input
                type="url"
                value={resourceUrl}
                onChange={(event) => {
                  setResourceUrl(event.target.value);
                  setInspection(null);
                  setResult(null);
                  setError("");
                }}
                placeholder="https://provider.example/resource"
                onKeyDown={(event) => event.key === "Enter" && resourceUrl.trim() && void inspect()}
              />
            </label>
            <div className="ms-x402-console__actions">
              <button type="button" className="ms-button" disabled={!resourceUrl.trim() || Boolean(busy)} onClick={() => void inspect()}>
                {busy === "inspect" ? <LoaderCircle className="ms-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                {busy === "inspect" ? "Checking…" : "Check price"}
              </button>
              {inspection?.status === "payment_required" && (
                <button type="button" className="ms-button ms-button--signal" disabled={Boolean(busy) || (Boolean(wallet) && !offers.payable.length)} onClick={() => void pay()}>
                  {busy === "pay" ? <LoaderCircle className="ms-spin" aria-hidden="true" /> : <WalletCards aria-hidden="true" />}
                  {!wallet ? "Connect wallet to pay" : busy === "pay" ? "Waiting for wallet…" : `Pay · max ${X402_MAX_PER_PAYMENT}`}
                </button>
              )}
            </div>
            {error && <div className="ms-error">{error}</div>}
            {inspection?.status === "free" && (
              <div className="ms-x402-result">
                <strong>HTTP {inspection.httpStatus} · no x402 payment requested</strong>
                <small>{inspection.contentType}</small>
                <pre>{inspection.preview || "(empty response)"}</pre>
              </div>
            )}
            {inspection?.status === "payment_required" && (
              <div className="ms-x402-offers">
                <div>
                  <strong>HTTP 402 · {inspection.required.accepts.length} payment offer{inspection.required.accepts.length === 1 ? "" : "s"}</strong>
                  <small>{inspection.required.resource?.description || inspection.required.resource?.url || "Paid resource"}</small>
                </div>
                {inspection.required.accepts.map((offer, index) => {
                  const canPay = offers.payable.includes(offer);
                  return (
                    <article className={canPay ? "is-payable" : ""} key={`${offer.network}-${offer.scheme}-${index}`}>
                      <span>{offer.network}</span>
                      <strong>{offer.scheme} · {offer.amount} atomic</strong>
                      <small>{canPay ? "Wallet and spend policy match" : `Matching wallet, default asset, and ≤${X402_MAX_PER_PAYMENT} price required`} · pays {offer.payTo.slice(0, 8)}…{offer.payTo.slice(-6)}</small>
                    </article>
                  );
                })}
              </div>
            )}
            {result && (
              <div className="ms-x402-result is-paid">
                <strong>Provider returned HTTP {result.httpStatus}</strong>
                <small>{result.settlement ? "PAYMENT-RESPONSE received · settlement reference below" : "No settlement header was returned"}</small>
                {Boolean(result.settlement) && <pre>{JSON.stringify(result.settlement, null, 2)}</pre>}
                <pre>{result.body || "(empty resource)"}</pre>
              </div>
            )}
          </div>
          <aside className="ms-x402-networks">
            <small>Protocol coverage</small>
            <h3>Discover everything. Pay only what the wallet can prove.</h3>
            <ul>
              {X402_NETWORK_FAMILIES.map((family) => (
                <li key={family.id} className={family.state === "live" ? "is-live" : ""}>
                  <i />
                  <span><strong>{family.label}</strong><small>{family.id}</small></span>
                  <em>{family.state === "live" ? "live" : "wallet needed"}</em>
                </li>
              ))}
            </ul>
            <p>Beta networks are discovered from the provider's signed 402 response. MuseTools does not claim a network is payable until its signer is connected.</p>
          </aside>
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
          <li className="complete"><KeyRound /><span><strong>x402 buyer</strong><small>Provider is the payee · active EVM network · exact scheme</small></span></li>
          <li className="complete"><ShieldCheck /><span><strong>Spend policy</strong><small>Explicit action · default assets only · {X402_MAX_PER_PAYMENT} maximum per payment</small></span></li>
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
