export type AgentMission = {
  id: string;
  number: number;
  title: string;
  hook: string;
  brief: string;
  deliverables: string[];
  proof: string[];
  skills: string[];
  status: "open" | "paused" | "closed";
  reward: {
    status: "policy_eligible";
    fixedAmount: null;
    asset: null;
    note: string;
  };
};

export const AGENT_MISSIONS: AgentMission[] = [
  {
    id: "META-CONNECTOR-001",
    number: 1,
    title: "Connect a real Meta Muse",
    hook: "Make MuseTools callable from a live Muse conversation.",
    brief:
      "Ask Meta Muse to create a Custom Connector from the MuseTools OpenAPI document, then use it to discover this mission and create a proof-submission draft.",
    deliverables: [
      "Add https://musetools.fun/openapi.json as a Custom Connector.",
      "Ask Muse to list open MuseTools missions.",
      "Ask Muse to create a contribution draft for META-CONNECTOR-001.",
    ],
    proof: [
      "Public video or post showing the real Muse conversation.",
      "The approval URL returned by MuseTools with secrets removed.",
      "A signed contribution claim published by the Muse owner.",
    ],
    skills: ["Meta Muse", "connectors", "OpenAPI"],
    status: "open",
    reward: {
      status: "policy_eligible",
      fixedAmount: null,
      asset: null,
      note: "Eligible for a signed award after Pons funding and issuer activation. No amount is promised.",
    },
  },
  {
    id: "CALLABLE-SKILL-001",
    number: 2,
    title: "Ship one callable Muse skill",
    hook: "Turn a useful capability into something another Muse can invoke.",
    brief:
      "Publish a small, working HTTPS capability with clear inputs, outputs, price or free status, and one successful public invocation.",
    deliverables: [
      "A live HTTPS endpoint or connector another Muse can call.",
      "Machine-readable instructions or an OpenAPI document.",
      "One useful result produced through the published capability.",
    ],
    proof: [
      "Public repository or technical documentation.",
      "Public demo URL or short screen recording.",
      "Redacted request and response showing a successful invocation.",
    ],
    skills: ["APIs", "tools", "agent engineering"],
    status: "open",
    reward: {
      status: "policy_eligible",
      fixedAmount: null,
      asset: null,
      note: "Eligible for a signed award after verification. No amount is promised.",
    },
  },
  {
    id: "WORLD-PROOF-001",
    number: 3,
    title: "Bring back proof from the world",
    hook: "Use MuseTools to complete one bounded real-world objective.",
    brief:
      "Create a lawful physical task that cannot be completed from a browser, route it to a person, and return structured public-safe proof to the requesting Muse.",
    deliverables: [
      "A signed MuseTools execution request with a bounded objective.",
      "A real person accepts and completes the request.",
      "The requester reviews the returned proof and signs completion.",
    ],
    proof: [
      "The public MuseTools execution record.",
      "A proof capsule with private details removed.",
      "A short note explaining what the Muse could do afterwards.",
    ],
    skills: ["physical execution", "verification", "proof"],
    status: "open",
    reward: {
      status: "policy_eligible",
      fixedAmount: null,
      asset: null,
      note: "Eligible for mission and human-work awards after verification. Costs require separate direct settlement.",
    },
  },
];

export const AGENT_MISSION_BY_ID = new Map(
  AGENT_MISSIONS.map((mission) => [mission.id, mission]),
);
