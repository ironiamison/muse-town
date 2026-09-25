/**
 * DEMO DATA — the flagship example execution.
 *
 * Everything in this module is an illustrative walkthrough. It is never merged
 * with signed network records and every surface that renders it must label it
 * as an example. Real activity comes only from `useNetworkData()`.
 */
import { MOTION_ASSETS } from "../config/motionAssets";
import { PHYSICAL_ASSETS } from "../config/physicalAssets";

export const DEMO_LABEL = "Example execution · not a live record";

export type LoopStage =
  | "idle"
  | "power"
  | "continuation"
  | "intent"
  | "matching"
  | "accepted"
  | "executing"
  | "proof"
  | "returned";

export const LOOP_ORDER: LoopStage[] = [
  "idle",
  "power",
  "continuation",
  "intent",
  "matching",
  "accepted",
  "executing",
  "proof",
  "returned",
];

export const FLAGSHIP = {
  continuationId: "inspect_vehicle",
  intent: "Inspect this Porsche in Warsaw before I buy it.",
  determination: {
    capability: "inspect_vehicle",
    execution: "human",
    location: "Warsaw, PL",
    proof: ["photos", "video", "VIN", "condition", "paint", "cold start"],
  },
  executor: { name: "Kasia", rating: "4.97", distanceKm: 1.4, completed: 38 },
  timeline: [
    { key: "accepted", label: "Accepted", at: "18:44" },
    { key: "arrived", label: "Arrived", at: "14:02" },
    { key: "inspecting", label: "Inspecting", at: "4 / 6" },
    { key: "proof", label: "Proof", at: "Pending" },
  ],
  media: {
    dispatch: MOTION_ASSETS.dispatch,
    onsite: MOTION_ASSETS.onsite,
    proof: MOTION_ASSETS.proof,
    stills: [PHYSICAL_ASSETS.heroVehicle, PHYSICAL_ASSETS.roadVehicle, PHYSICAL_ASSETS.dashboard],
  },
  findings: [
    { label: "VIN", value: "Match", signal: false },
    { label: "Exterior", value: "Good", signal: false },
    { label: "Interior", value: "Excellent", signal: false },
    { label: "Paint", value: "Repaint detected", signal: true },
    { label: "Undisclosed", value: "Passenger-side door", signal: true },
  ],
  result: "Passenger-side door shows evidence of repainting not disclosed in the listing.",
  payment: { amount: 31, currency: "USD", rail: "direct" },
} as const;

/** Timing for the automatic playback of the example, in milliseconds per stage. */
export const STAGE_DURATION: Partial<Record<LoopStage, number>> = {
  matching: 1500,
  accepted: 1400,
  executing: 4200,
  proof: 2600,
};
