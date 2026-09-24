import { Bot, Building2, Cpu, UserRound } from "lucide-react";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function NetworkAvatar({
  name,
  image,
  type,
  size = "medium",
}: {
  name: string;
  image?: string;
  type: string;
  size?: "small" | "medium" | "large";
}) {
  const fallback =
    type === "human" ? (
      <UserRound aria-hidden="true" />
    ) : type === "business" ? (
      <Building2 aria-hidden="true" />
    ) : type === "service" || type === "api" || type === "device" ? (
      <Cpu aria-hidden="true" />
    ) : (
      <Bot aria-hidden="true" />
    );
  return (
    <span
      className={`en-avatar en-avatar--${size} en-avatar--${type}`}
      title={`${name} · ${type}`}
    >
      {image ? (
        <img src={image} alt="" />
      ) : initials(name) ? (
        <span className="en-avatar__initials">{initials(name)}</span>
      ) : (
        fallback
      )}
    </span>
  );
}
