import type { SVGProps } from "react";

/**
 * Muse Town pictograms. One ink stroke weight, one accent fill (`.ic-accent`,
 * coloured via CSS so it follows day/night). Drawn on a 24-unit grid.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The mark: a town on a plate — one gabled house on a tilted disc, a low sun. */
export function MuseMark({ size = 28, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...rest}>
      <ellipse cx="16" cy="22.5" rx="13" ry="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 22V14.5L16 9l6.5 5.5V22" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7.5 15.5 16 8l8.5 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 22v-5h4v5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle className="ic-accent" cx="25.5" cy="7" r="3" />
    </svg>
  );
}

/* ----- Systems (left rail) ------------------------------------------------ */

/** Quests: a notice pinned to a board. */
export function QuestIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 5.5h12v14l-3-2-3 2-3-2-3 2z" />
      <path d="M9 10h6M9 13.5h4" />
      <circle className="ic-accent" cx="12" cy="5.5" r="1.9" stroke="none" />
    </Svg>
  );
}

/** Skills: a compass rose. */
export function SkillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path className="ic-accent" d="M12 6.5 14 12l-2 5.5L10 12z" stroke="none" />
      <path d="M6.5 12h2M15.5 12h2M12 3.5v1.5M12 19v1.5" />
    </Svg>
  );
}

/** Market: a stall with an awning. */
export function MarketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 10.5 6 6h12l1.5 4.5" />
      <path className="ic-accent" d="M4.5 10.5c0 1.4 1.1 2.4 2.5 2.4s2.5-1 2.5-2.4c0 1.4 1.1 2.4 2.5 2.4s2.5-1 2.5-2.4c0 1.4 1.1 2.4 2.5 2.4s2.5-1 2.5-2.4H4.5z" stroke="none" />
      <path d="M6.5 13v6h11v-6M10 19v-4h4v4" />
    </Svg>
  );
}

/** Map: a folded plan with a route. */
export function MapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7.5 9 5.5l6 2 5-2v11l-5 2-6-2-5 2z" />
      <path d="M9 5.5v11M15 7.5v11" />
      <circle className="ic-accent" cx="12" cy="12" r="1.7" stroke="none" />
    </Svg>
  );
}

/* ----- Districts ---------------------------------------------------------- */

/** The Common: a fountain. */
export function CommonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 16.5h15" />
      <path d="M6 16.5c0 2 2.7 3 6 3s6-1 6-3" />
      <path d="M9 13h6l-1 3.5h-4z" />
      <path d="M12 13V8.5" />
      <path className="ic-accent" d="M12 4.5c-1.6 1.2-2 2.6-2 3.6a2 2 0 1 0 4 0c0-1-.4-2.4-2-3.6z" stroke="none" />
    </Svg>
  );
}

/** The Works: sawtooth roof and chimney. */
export function WorksIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 19.5v-9l4.5 3v-3l4.5 3v-3l4.5 3v6z" />
      <path d="M17.5 10.5V6h2v5" />
      <path className="ic-accent" d="M8 19.5v-3h3v3z" stroke="none" />
    </Svg>
  );
}

/** Market Row: striped awning over a shopfront. */
export function MarketRowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9.5h14" />
      <path className="ic-accent" d="M5 9.5v1.2a1.6 1.6 0 0 0 3.2 0v-1.2h-3.2zm5.4 0v1.2a1.6 1.6 0 0 0 3.2 0v-1.2h-3.2zm5.4 0v1.2a1.6 1.6 0 0 0 3.2 0v-1.2h-3.2z" stroke="none" />
      <path d="M6.5 6.5h11l1.5 3M6.5 6.5 5 9.5" />
      <path d="M6.5 12.5v7h11v-7M13.5 19.5v-4.5h3v4.5" />
    </Svg>
  );
}

/** Assembly: pediment and columns. */
export function AssemblyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 9.5 12 4.5l7.5 5z" />
      <path d="M6.5 10v7M10 10v7M14 10v7M17.5 10v7" />
      <path d="M4.5 17.5h15v2h-15z" />
      <circle className="ic-accent" cx="12" cy="7.8" r="1.1" stroke="none" />
    </Svg>
  );
}

/** The School: a bell tower over an open book. */
export function SchoolIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 10.5V7l2.5-2.5L14.5 7v3.5" />
      <path d="M4.5 19.5c2.3-1.2 5-1.2 7.5 0 2.5-1.2 5.2-1.2 7.5 0V11c-2.3-1.2-5-1.2-7.5 0-2.5-1.2-5.2-1.2-7.5 0z" />
      <path d="M12 11v8.5" />
      <circle className="ic-accent" cx="12" cy="7.8" r="1.1" stroke="none" />
    </Svg>
  );
}

/* ----- Header & actions --------------------------------------------------- */

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </Svg>
  );
}

/** Invite: an open door with light spilling. */
export function DoorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 20V5.5h9V20" />
      <path className="ic-accent" d="M14.5 5.5 19 8v12l-4.5-2.5z" stroke="none" />
      <path d="M5.5 20h13.5" />
      <circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Passport: a stamped card. */
export function PassportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="2" />
      <circle cx="9.5" cy="11" r="2.2" />
      <path d="M13.5 9.5h3.5M13.5 12.5h3.5M7 16h10" />
      <circle className="ic-accent" cx="16.5" cy="7.5" r="1.1" stroke="none" />
    </Svg>
  );
}

/** Follow the feed: a small flag. */
export function FlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 20V4.5" />
      <path className="ic-accent" d="M6.5 5h11l-2.5 3.5L17.5 12h-11z" stroke="none" />
    </Svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.7v.4" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Island: a floating room a Muse founded. */
export function IslandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 13.5h15l-3 4h-9z" />
      <path d="M9 13.5V9.5l3-2.5 3 2.5v4" />
      <path className="ic-accent" d="M11 13.5v-2.5h2v2.5z" stroke="none" />
      <path d="M7.5 20.5c1-1 2-1 3 0M13.5 20.5c1-1 2-1 3 0" />
    </Svg>
  );
}

export const districtIcons = {
  porch: CommonIcon,
  workshop: WorksIcon,
  market: MarketRowIcon,
  hall: AssemblyIcon,
  school: SchoolIcon,
} as const;
