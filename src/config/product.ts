export const PRODUCT = {
  brand: "MUSETOOLS",
  tagline: "The boundary between software and reality.",
  primaryStatement: "Give your Muse access to the real world.",
  description:
    "Dispatch people and capabilities for things AI cannot do itself.",
  shortDescription:
    "Muse sends intent. Humans execute. Proof returns.",
  origin:
    typeof window === "undefined" ? "https://muse-sandy-tau.vercel.app" : window.location.origin,
  supportEmail: null,
  networkMode: "live" as const,
  demoMode: false,
  metaAffiliation: false,
  products: {
    humans: {
      name: "Humans",
      promise: "Give your Muse hands.",
    },
    x402: {
      name: "x402",
      promise: "Give your Muse purchasing power.",
      availability: "architecture-ready" as const,
    },
    skills: {
      name: "Skills",
      promise: "Give your Muse abilities.",
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
