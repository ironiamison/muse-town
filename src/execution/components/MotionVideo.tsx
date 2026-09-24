import { useEffect, useRef, useState } from "react";
import type { MotionAsset } from "../../config/motionAssets";

export default function MotionVideo({
  asset,
  className,
  label,
  eager = false,
}: {
  asset: MotionAsset;
  className?: string;
  label: string;
  eager?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) video.pause();
    };
    preference.addEventListener("change", updatePreference);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (preference.matches || !entry.isIntersecting) {
          video.pause();
          return;
        }
        void video.play().catch(() => undefined);
      },
      { threshold: 0.12 },
    );
    observer.observe(video);

    return () => {
      preference.removeEventListener("change", updatePreference);
      observer.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      src={asset.src}
      poster={asset.poster}
      autoPlay={!reducedMotion}
      muted
      loop={!reducedMotion}
      playsInline
      preload={eager ? "auto" : "metadata"}
      aria-label={label}
    />
  );
}
