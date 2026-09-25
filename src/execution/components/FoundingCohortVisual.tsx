import type { CSSProperties } from "react";

const COHORT_POINTS = Array.from({ length: 100 }, (_, index) => {
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const radius = 27 + Math.sqrt((index + 1) / 100) * 18;
  return {
    left: 50 + Math.cos(angle) * radius,
    top: 50 + Math.sin(angle) * radius,
    size: 22 + ((index * 7) % 11),
    rotation: -12 + ((index * 17) % 25),
    delay: -((index * 0.13) % 4.8),
    duration: 4.6 + ((index * 11) % 18) / 10,
  };
});

export default function FoundingCohortVisual({
  count,
  workingCount = 0,
  compact = false,
  className = "",
}: {
  count: number;
  workingCount?: number;
  compact?: boolean;
  className?: string;
}) {
  const foundingCount = Math.min(Math.max(count, 0), 100);
  const openCount = 100 - foundingCount;
  const sizeScale = compact ? 0.58 : 1;

  return (
    <div className={`fm-cohort-visual ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <div className="fm-cohort" aria-hidden="true">
        <div className="fm-cohort__rings" />
        <div className="fm-cohort__muses">
          {COHORT_POINTS.map((point, index) => (
            <span
              className={`fm-cohort__muse ${index < foundingCount ? "is-claimed" : ""}`}
              data-tone={index % 6}
              key={index}
              style={{
                left: `${point.left}%`,
                top: `${point.top}%`,
                width: point.size * sizeScale,
                height: point.size * 1.18 * sizeScale,
                "--rotation": `${point.rotation}deg`,
                "--delay": `${point.delay}s`,
                "--duration": `${point.duration}s`,
              } as CSSProperties}
            >
              <i /><i />
            </span>
          ))}
        </div>
      </div>
      <div
        className="fm-count"
        aria-label={`${foundingCount} of 100 founding profiles claimed`}
        style={{ "--cohort-progress": `${foundingCount * 3.6}deg` } as CSSProperties}
      >
        <span>Live founding cohort</span>
        <strong>{foundingCount}<i>/100</i></strong>
        <div><b style={{ width: `${foundingCount}%` }} /></div>
        <p>{workingCount} working · {openCount} spots open</p>
      </div>
    </div>
  );
}
