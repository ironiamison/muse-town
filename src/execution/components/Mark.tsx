import { useId } from "react";

/**
 * MuseTools mark: four petals opening outward from a square of negative space —
 * an aperture. One colour, symmetric, crisp at 20px. Vector reproduction of the
 * generated concept (assets/musetools-mark-c.png).
 */
const PETAL =
  "M48 23.96L48 48L23.96 48L15.98 40.02A17 17 0 1 1 40.02 15.98Z";

export default function Mark({ size = 28, className, color }: { size?: number; className?: string; color?: string }) {
  const id = useId().replace(/:/g, "");
  const fill = color ?? "var(--ms-signal, #2f4ee6)";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`m-${id}`}>
          <rect width="100" height="100" fill="#fff" />
          <rect x="42" y="42" width="16" height="16" rx="4" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#m-${id})`} fill={fill}>
        <path d={PETAL} />
        <path d={PETAL} transform="rotate(90 50 50)" />
        <path d={PETAL} transform="rotate(180 50 50)" />
        <path d={PETAL} transform="rotate(270 50 50)" />
      </g>
    </svg>
  );
}
