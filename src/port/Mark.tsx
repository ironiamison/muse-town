/* PORT mark: a threshold. A closed chamber on the left (the machine side), an
   opening on the right, and one line that leaves through it (the route). */

export function PortMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="M5 5h16v7" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
      <path d="M21 20v7H5V5" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
      <path d="M11 16h20" stroke="currentColor" strokeWidth="3" />
      <path d="M26 11.5 31 16l-5 4.5" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
    </svg>
  );
}

export function PortWordmark({ height = 22 }: { height?: number }) {
  return (
    <span className="p-wordmark" style={{ fontSize: height }}>
      PORT
    </span>
  );
}

/* Clearance mark: a stepped stack, one bar per level. Not a badge, a gauge. */
export function ClearanceMark({ level, size = 14 }: { level: "H1" | "H2" | "H3" | "H4"; size?: number }) {
  const n = Number(level[1]);
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={`Clearance ${level}`} className="p-clr">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={1 + i * 3.6}
          y={13 - (i + 1) * 3}
          width="2.8"
          height={(i + 1) * 3}
          fill={i < n ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={i < n ? 0 : 0.9}
          opacity={i < n ? 1 : 0.45}
        />
      ))}
    </svg>
  );
}
