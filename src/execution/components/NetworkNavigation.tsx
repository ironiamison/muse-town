import { Activity, Bell, Hand, Menu, Sparkles, UserRound, Users, X } from "lucide-react";
import { useState } from "react";
import { PRODUCT } from "../../config/product";
import type { ConnectedMuse } from "../../lib/muse-state";
import type { WalletSession } from "../../lib/wallet";
import { Link, type Route } from "../router";
import Mark from "./Mark";

function active(route: Route, names: Route["name"][]) {
  return names.includes(route.name);
}

export default function NetworkNavigation({
  route,
  muse,
  wallet,
  onIdentity,
  onWallet,
  onTour,
  inboxCount,
}: {
  route: Route;
  muse: ConnectedMuse | null;
  wallet: WalletSession | null;
  onIdentity: () => void;
  onWallet: () => void;
  onTour: () => void;
  inboxCount: number;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <header className="ms-nav">
        <Link href="/" className="ms-nav__brand" onClick={close}>
          <Mark size={30} className="ms-nav__mark" />
          <span>{PRODUCT.brand}</span>
        </Link>
        <nav className="ms-nav__center" aria-label="Primary">
          <Link href="/muses" className={active(route, ["muses"]) ? "is-active" : ""}>
            First 100
          </Link>
          <Link href="/missions" className={active(route, ["missions"]) ? "is-active" : ""}>
            Missions
          </Link>
          <Link href="/capabilities" className={active(route, ["capabilities", "capability", "skills"]) ? "is-active" : ""}>
            Powers
          </Link>
          <Link href="/humans" className={active(route, ["humans", "tasks", "task"]) ? "is-active" : ""}>
            Humans
          </Link>
          <Link href="/activity" className={active(route, ["activity", "execution"]) ? "is-active" : ""}>
            Proof
          </Link>
          <Link href="/developers" className={active(route, ["developers", "build", "docs", "x402"]) ? "is-active" : ""}>
            Connect
          </Link>
        </nav>
        <div className="ms-nav__actions">
          <Link href="/inbox" className={`ms-nav__inbox ${active(route, ["inbox"]) ? "is-active" : ""}`} ariaLabel={`Inbox${inboxCount ? `, ${inboxCount} actions` : ""}`}>
            <Bell aria-hidden="true" />
            {inboxCount > 0 && <b>{Math.min(inboxCount, 9)}</b>}
          </Link>
          <button type="button" className={`ms-nav__muse ${muse ? "is-connected" : ""}`} onClick={onIdentity} data-tour="connect">
            {muse?.avatarUrl ? <img src={muse.avatarUrl} alt="" /> : <UserRound aria-hidden="true" />}
            <span>{muse?.name ?? "Connect Muse"}</span>
          </button>
          <button type="button" className="ms-nav__menu" onClick={() => setOpen((value) => !value)} aria-label="Menu" aria-expanded={open}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <img className="ms-nav__hanging-muse" src="/muse-nav-perch.png" alt="" aria-hidden="true" />
        {open && (
          <nav className="ms-nav__sheet" aria-label="Menu">
            <Link href="/muses" onClick={close}>First 100 Muses</Link>
            <Link href="/missions" onClick={close}>Agent Missions</Link>
            <Link href="/capabilities" onClick={close}>Powers</Link>
            <Link href="/humans" onClick={close}>Humans</Link>
            <Link href="/activity" onClick={close}>Proof</Link>
            <Link href="/developers" onClick={close}>Connect a Muse</Link>
            <Link href="/inbox" onClick={close}>Inbox {inboxCount ? `· ${inboxCount}` : ""}</Link>
            <Link href="/x402" onClick={close}>Settlement</Link>
            <button type="button" onClick={() => { close(); onIdentity(); }}>
              {muse ? `${muse.name} · manage` : "Connect Muse"}
            </button>
            <button type="button" onClick={() => { close(); onWallet(); }}>
              {wallet ? "Payment wallet connected" : "Connect payment wallet"}
            </button>
            <button type="button" onClick={() => { close(); onTour(); }}>
              Take the tour
            </button>
          </nav>
        )}
      </header>
      <nav className="ms-tabbar" aria-label="Mobile primary">
        <Link href="/muses" className={active(route, ["muses", "missions"]) ? "is-active" : ""}>
          <Users aria-hidden="true" /><span>Muses</span>
        </Link>
        <Link href="/capabilities" className={active(route, ["capabilities", "capability", "skills"]) ? "is-active" : ""}>
          <Sparkles aria-hidden="true" /><span>Powers</span>
        </Link>
        <Link href="/humans" className={active(route, ["humans", "tasks", "task"]) ? "is-active" : ""}>
          <Hand aria-hidden="true" /><span>Humans</span>
        </Link>
        <Link href="/activity" className={active(route, ["activity", "execution", "rewards", "x402"]) ? "is-active" : ""}>
          <Activity aria-hidden="true" /><span>Proof</span>
        </Link>
        <button type="button" onClick={onIdentity} className={route.name === "profile" ? "is-active" : ""}>
          <UserRound aria-hidden="true" /><span>{muse ? "You" : "Connect"}</span>
        </button>
      </nav>
    </>
  );
}
