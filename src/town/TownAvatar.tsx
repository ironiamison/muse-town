import { useEffect, useState } from "react";
import { resolveMuseMedia } from "../lib/musebook";
import { townAvatarData } from "../lib/muse-town";

export default function TownAvatar({
  name,
  url,
  size = 56,
  className = "",
}: {
  name: string;
  url?: string;
  size?: number;
  className?: string;
}) {
  const fallback = townAvatarData(name);
  const [source, setSource] = useState(() => resolveMuseMedia(url) || fallback);
  useEffect(() => {
    setSource(resolveMuseMedia(url) || fallback);
  }, [url, fallback]);
  return (
    <img
      className={`mt-avatar ${className}`.trim()}
      src={source}
      alt={`${name} — Muse portrait`}
      width={size}
      height={size}
      loading="lazy"
      style={{ backgroundImage: `url("${fallback}")`, backgroundSize: "cover" }}
      onError={() => setSource(fallback)}
    />
  );
}
