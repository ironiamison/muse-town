import {
  ArrowDown,
  CircleDollarSign,
  Gift,
  Hand,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { MuseIdentity } from "../../lib/musebook";

export type MuseCapability = "humans" | "x402" | "skills";

const capabilityCopy = {
  humans: { label: "Humans", gain: "Hands", icon: Hand },
  x402: { label: "x402", gain: "Money", icon: CircleDollarSign },
  skills: { label: "Skills", gain: "Abilities", icon: Sparkles },
};

export default function MuseCore({
  identity,
  active,
  actionLabel,
  resultLabel,
  onCapability,
  onConnect,
  compact = false,
}: {
  identity: MuseIdentity | null;
  active: MuseCapability | null;
  actionLabel?: string;
  resultLabel?: string;
  onCapability?: (capability: MuseCapability) => void;
  onConnect?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mc-system ${active ? `is-active is-${active}` : ""} ${
        compact ? "is-compact" : ""
      }`}
      aria-label="Muse capability system"
    >
      <div className="mc-system__connections" aria-hidden="true">
        <i className="mc-line mc-line--humans"><b /></i>
        <i className="mc-line mc-line--x402"><b /></i>
        <i className="mc-line mc-line--skills"><b /></i>
      </div>
      {(Object.keys(capabilityCopy) as MuseCapability[]).map((capability) => {
        const item = capabilityCopy[capability];
        const Icon = item.icon;
        return (
          <button
            className={`mc-capability mc-capability--${capability}`}
            key={capability}
            onClick={() => onCapability?.(capability)}
            aria-pressed={active === capability}
          >
            <span className="mc-capability__icon"><Icon /></span>
            <span>
              <small>{item.label}</small>
              <strong>{item.gain}</strong>
            </span>
            <em>{active === capability ? "active" : "available"}</em>
          </button>
        );
      })}
      <button className="mc-core" onClick={onConnect}>
        <span className="mc-core__frame">
          {identity?.avatarUrl ? (
            <img src={identity.avatarUrl} alt="" />
          ) : (
            <UserRound aria-hidden="true" />
          )}
          <i />
        </span>
        <span className="mc-core__identity">
          <small>Muse</small>
          <strong>{identity?.name ?? "Not connected"}</strong>
          <em>{identity ? "Ready" : "Connect Muse"}</em>
        </span>
      </button>
      <div className="mc-action">
        <ArrowDown />
        <span><small>Action</small><strong>{actionLabel ?? "Capability ready"}</strong></span>
      </div>
      <div className="mc-result">
        <span><small>Result</small><strong>{resultLabel ?? "Waiting for action"}</strong></span>
        <i />
      </div>
      <div className="mc-reward">
        <Gift />
        <span><small>Useful activity</small><strong>Rewards output</strong></span>
      </div>
    </div>
  );
}
