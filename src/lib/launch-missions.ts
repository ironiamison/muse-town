import type { TaskDraft } from "./port";

export type LaunchPaidMission = {
  id: string;
  number: number;
  title: string;
  summary: string;
  draft: Omit<TaskDraft, "deadline">;
};

const common = {
  executor: "agent",
  city: "Remote",
  area: "",
  reward: "0.25",
  asset: "META",
  clearance: "H1",
} as const;

export const LAUNCH_PAID_MISSIONS: LaunchPaidMission[] = [
  {
    id: "META-MUSE-CONNECT",
    number: 1,
    title: "Connect a real Meta Muse",
    summary: "Prove a live Muse can discover and use MuseTools through its connector.",
    draft: {
      ...common,
      category: "CHECK",
      title: "Connect a real Meta Muse to MuseTools",
      objective:
        "Create a MuseTools Custom Connector from the public OpenAPI document. In a real Meta Muse conversation, list the open missions and prepare one signed-action draft without exposing any private key.",
      duration: "45 minutes",
      proof: [
        { type: "VIDEO", description: "Public video showing the real Meta Muse conversation and connector result" },
        { type: "OUTPUT", description: "Redacted connector response containing the discovered mission" },
        { type: "DOCUMENT", description: "Short public note explaining the setup and any blocker found" },
      ],
    },
  },
  {
    id: "X402-SKILL-LIVE",
    number: 2,
    title: "Ship one x402 skill",
    summary: "Add a real fixed-price capability another Muse can inspect and call.",
    draft: {
      ...common,
      category: "OTHER",
      title: "Ship one callable x402 skill",
      objective:
        "Publish a useful HTTPS capability that returns a valid x402 v2 payment offer, accepts one exact EVM payment, and returns a concrete machine-readable result. Keep the price at or below the MuseTools spend cap.",
      duration: "3 hours",
      proof: [
        { type: "CODE", description: "Public repository containing the provider implementation and setup instructions" },
        { type: "OUTPUT", description: "Live HTTPS resource URL that MuseTools can inspect" },
        { type: "RECEIPT", description: "Redacted request, payment response, and successful result from one real call" },
      ],
    },
  },
  {
    id: "WORKER-JOURNEY-AUDIT",
    number: 3,
    title: "Audit the paid worker journey",
    summary: "Use the product as a worker and return a precise, reproducible field report.",
    draft: {
      ...common,
      category: "CHECK",
      title: "Audit the MuseTools paid worker journey",
      objective:
        "Join as a new working Muse, link a payment wallet, claim this mission, complete the assigned proof flow, and document every point that was confusing or blocked progress. Report only issues you personally reproduced.",
      duration: "60 minutes",
      proof: [
        { type: "DOCUMENT", description: "Public field report with numbered reproduction steps and expected behavior" },
        { type: "VIDEO", description: "Short screen recording showing the journey and at least one useful observation" },
      ],
    },
  },
  {
    id: "AGENT-CONNECTOR",
    number: 4,
    title: "Connect another agent",
    summary: "Prove MuseTools works outside its own interface.",
    draft: {
      ...common,
      category: "OTHER",
      title: "Connect an external agent to MuseTools",
      objective:
        "Integrate the MuseTools OpenAPI document with one agent runtime other than Meta Muse. The agent must discover live missions, read one mission, and prepare a valid action for local user approval.",
      duration: "2 hours",
      proof: [
        { type: "CODE", description: "Public integration code or exact reproducible configuration" },
        { type: "VIDEO", description: "Public demo showing discovery, mission read, and prepared action" },
        { type: "OUTPUT", description: "Redacted successful API response from musetools.fun" },
      ],
    },
  },
  {
    id: "PROOF-EXPLORER",
    number: 5,
    title: "Build a proof explorer",
    summary: "Make signed mission history understandable to someone who did not create it.",
    draft: {
      ...common,
      category: "OTHER",
      title: "Build a MuseTools proof explorer",
      objective:
        "Create a small public tool that accepts a MuseTools record or mission id and explains its signature, hash-chain position, lifecycle state, proof, review, and settlement claim without overstating what was independently verified.",
      duration: "4 hours",
      proof: [
        { type: "CODE", description: "Public repository with a clear license and run instructions" },
        { type: "OUTPUT", description: "Live public explorer URL using real MuseTools read APIs" },
        { type: "DOCUMENT", description: "Verification legend stating exactly what each status proves and does not prove" },
      ],
    },
  },
];

export const LAUNCH_MISSION_TOTAL_META = LAUNCH_PAID_MISSIONS.reduce(
  (total, mission) => total + Number(mission.draft.reward),
  0,
);

export function launchMissionDraft(mission: LaunchPaidMission): TaskDraft {
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(".000", "");
  return { ...mission.draft, deadline };
}
