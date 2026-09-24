import {
  Activity,
  Hand,
  Home,
  Menu,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { WalletSession } from "../../lib/wallet";
import { PRODUCT } from "../../config/product";
import { Link, type Route } from "../router";

function active(route: Route, names: Route["name"][]) {
  return names.includes(route.name);
}

export default function NetworkNavigation({
  route,
  identity,
  wallet,
  networkState,
  onIdentity,
  onWallet,
}: {
  route: Route;
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  networkState: "loading" | "live" | "offline";
  onIdentity: () => void;
  onWallet: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <header className="en-nav">
        <Link href="/" className="en-nav__brand" onClick={close}>
          <span>{PRODUCT.brand}</span>
          <i className={`is-${networkState}`} title={`Network ${networkState}`} />
        </Link>
        <nav className="en-nav__center" aria-label="Primary">
          <Link href="/humans" className={active(route, ["humans"]) ? "active" : ""}>
            Humans
          </Link>
          <Link href="/capabilities" className={active(route, ["capabilities", "capability", "skills"]) ? "active" : ""}>
            Capabilities
          </Link>
          <Link href="/developers" className={active(route, ["developers", "build", "docs"]) ? "active" : ""}>
            Developers
          </Link>
        </nav>
        <div className="en-nav__actions">
          <button className="en-nav__identity" onClick={onIdentity}>
            <UserRound aria-hidden="true" />
            {identity?.name ?? "Connect Muse"}
          </button>
          <button className="en-nav__menu" onClick={() => setOpen((value) => !value)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="en-nav__mobile-menu" aria-label="Mobile menu">
            <Link href="/humans" onClick={close}>Humans</Link>
            <Link href="/capabilities" onClick={close}>Capabilities</Link>
            <Link href="/developers" onClick={close}>Developers</Link>
            <button onClick={() => { close(); onIdentity(); }}>
              {identity ? `Connected: ${identity.name}` : "Connect Muse"}
            </button>
            <button onClick={() => { close(); onWallet(); }}>
              {wallet ? "Payment wallet connected" : "Connect payment wallet"}
            </button>
          </nav>
        )}
      </header>
      <nav className="en-bottom-nav" aria-label="Mobile primary">
        <Link href="/" className={route.name === "home" ? "active" : ""}>
          <Home /><span>Home</span>
        </Link>
        <Link href="/humans" className={active(route, ["humans", "task"]) ? "active" : ""}>
          <Hand /><span>Humans</span>
        </Link>
        <Link href="/capabilities" className={active(route, ["capabilities", "skills"]) ? "active" : ""}>
          <Sparkles /><span>Capabilities</span>
        </Link>
        <Link href="/activity" className={active(route, ["activity", "execution", "rewards", "x402"]) ? "active" : ""}>
          <Activity /><span>Activity</span>
        </Link>
        <button onClick={onIdentity} className={route.name === "profile" ? "active" : ""}>
          <UserRound /><span>Profile</span>
        </button>
      </nav>
    </>
  );
}
