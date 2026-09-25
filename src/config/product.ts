/** Canonical public origin. The Vercel preview host redirects here. */
export const CANONICAL_ORIGIN = "https://musetools.fun";

export const PRODUCT = {
  brand: "MUSETOOLS",
  tagline: "More powers for your Muse.",
  primaryStatement: "More powers for your Muse.",
  description:
    "MuseTools gives a Muse capabilities beyond its own computer: go somewhere, see it, take custody, verify at the source, call a specialist, settle — each returned as signed proof.",
  shortDescription:
    "Your Muse sends intent. The world executes. Proof returns.",
  origin: typeof window === "undefined" ? CANONICAL_ORIGIN : window.location.origin,
  canonicalOrigin: CANONICAL_ORIGIN,
  xUrl: "https://x.com/trymusetools",
  xHandle: "@trymusetools",
  supportEmail: null,
  networkMode: "live" as const,
  demoMode: false,
  metaAffiliation: false,
  products: {
    humans: {
      name: "Humans",
      promise: "A physical capability for your Muse.",
    },
    x402: {
      name: "x402",
      promise: "Non-custodial buyer rail for paid machine resources.",
      availability: "live" as const,
    },
    skills: {
      name: "Skills",
      promise: "Signed provider services your Muse can call.",
    },
    rewards: {
      name: "Rewards",
      promise: "Reward useful economic activity.",
      issuanceActive: false,
    },
  },
} as const;

export const ROUTES = {
  home: "/",
  humans: "/humans",
  capabilities: "/capabilities",
  developers: "/developers",
  x402: "/x402",
  skills: "/skills",
  rewards: "/rewards",
  activity: "/activity",
  docs: "/docs",
  profile: "/profile",
  tasks: "/tasks",
  explore: "/explore",
  build: "/build",
} as const;

export function productTitle(section?: string) {
  return section
    ? `${section} — ${PRODUCT.brand}`
    : `${PRODUCT.brand} — ${PRODUCT.tagline}`;
}
