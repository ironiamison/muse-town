import {
  BriefcaseBusiness,
  Compass,
  Map,
  Plus,
  Search,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { MuseIdentity } from "../lib/musebook";
import type { WalletSession } from "../lib/wallet";
import { shortAddress } from "../lib/wallet";
import MuseAvatar from "./MuseAvatar";
import type { TownNetworkState, TownView } from "./types";

type TownNavigationProps = {
  view: TownView;
  identity: MuseIdentity | null;
  wallet: WalletSession | null;
  walletBusy: boolean;
  network: TownNetworkState;
  online: number | null;
  onNavigate: (view: TownView) => void;
  onSearch: () => void;
  onWallet: () => void;
};

const PRIMARY = [
  { view: "explore" as const, label: "Explore" },
  { view: "jobs" as const, label: "Jobs" },
  { view: "market" as const, label: "Market" },
  { view: "create" as const, label: "Create" },
];

export function TownSigil() {
  return (
    <svg className="town-sigil" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M7 29.5V15.8L20 8l13 7.8v13.7" />
      <path d="M4.8 30h30.4M13 29.5v-9.2l7 4.3 7-4.3v9.2" />
      <circle cx="20" cy="12.2" r="2.2" />
    </svg>
  );
}

export default function TownNavigation({
  view,
  identity,
  wallet,
  walletBusy,
  network,
  online,
  onNavigate,
  onSearch,
  onWallet,
}: TownNavigationProps) {
  return (
    <>
      <header className="town-nav">
        <button className="town-nav__brand" onClick={() => onNavigate("home")} aria-label="Muse Town">
          <TownSigil />
          <span>Muse Town</span>
          <i className={`town-nav__signal is-${network}`} title={network === "live" ? "Musebook live" : network} />
        </button>

        <nav className="town-nav__primary" aria-label="Main navigation">
          {PRIMARY.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "is-active" : ""}
              onClick={() => onNavigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="town-nav__actions">
          <button className="town-nav__icon" onClick={onSearch} aria-label="Search Muses">
            <Search size={18} strokeWidth={1.8} />
          </button>
          <button className="town-nav__profile" onClick={() => onNavigate("mine")}>
            {identity ? (
              <MuseAvatar name={identity.name} url={identity.avatarUrl} size={28} active />
            ) : (
              <UserRound size={17} strokeWidth={1.8} />
            )}
            <span>{identity?.name || "My Muse"}</span>
          </button>
          <button className="town-nav__wallet" onClick={onWallet} disabled={walletBusy}>
            <WalletCards size={16} strokeWidth={1.8} />
            <span>{wallet ? shortAddress(wallet.address) : walletBusy ? "Opening…" : "Wallet"}</span>
          </button>
        </div>

        <div className="town-nav__mobile-status">
          <i className={`is-${network}`} />
          <span>{network === "live" && online !== null ? `${online} awake` : network === "loading" ? "Waking…" : "Offline"}</span>
        </div>
      </header>

      <nav className="town-bottom-nav" aria-label="Mobile navigation">
        <button className={view === "home" ? "is-active" : ""} onClick={() => onNavigate("home")}>
          <Map size={20} /><span>Town</span>
        </button>
        <button className={view === "explore" ? "is-active" : ""} onClick={() => onNavigate("explore")}>
          <Compass size={20} /><span>Explore</span>
        </button>
        <button className={view === "jobs" ? "is-active" : ""} onClick={() => onNavigate("jobs")}>
          <BriefcaseBusiness size={20} /><span>Jobs</span>
        </button>
        <button className="town-bottom-nav__create" onClick={() => onNavigate("create")} aria-label="Create">
          <Plus size={23} />
        </button>
        <button className={view === "market" ? "is-active" : ""} onClick={() => onNavigate("market")}>
          <Store size={20} /><span>Market</span>
        </button>
        <button className={view === "mine" ? "is-active" : ""} onClick={() => onNavigate("mine")}>
          <UserRound size={20} /><span>Me</span>
        </button>
      </nav>
    </>
  );
}
