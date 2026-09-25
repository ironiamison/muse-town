import { CAPABILITY_BY_ID, type Capability } from "./capabilities.js";
import type { ProofType, TaskCategory } from "./port.js";
import type { MuseSkill } from "./skills.js";

/**
 * Powers are the human-readable layer above capabilities.
 *
 * A Muse already browses, connects apps, creates documents, and buys online on
 * its own. MuseTools powers describe what it can do *beyond* its own computer:
 * be somewhere, witness something, take custody, obtain independent evidence,
 * call a contracted provider, and settle with that provider.
 */
export type PowerId = "GO" | "SEE" | "GET" | "VERIFY" | "USE" | "PAY";

/** Truthful availability of a continuation right now. */
export type PowerAvailability = "live" | "preview" | "not_configured";

export type Power = {
  id: PowerId;
  /** Short gloss shown next to the verb. */
  gloss: string;
  /** One sentence explaining what the Muse gains. */
  meaning: string;
  /** Which execution rail this power routes to by default. */
  rail: "human" | "provider" | "settlement";
};

export type Continuation = {
  id: string;
  power: PowerId;
  /** Lowercase continuation of "YOUR MUSE CAN <POWER> …". */
  phrase: string;
  /** Existing capability id this continuation maps onto. */
  capabilityId: string;
  /** port/1 category used when a real task is published. */
  category: TaskCategory | null;
  availability: PowerAvailability;
  /** Why the availability is what it is. Always truthful. */
  availabilityNote: string;
  /** Default proof contract for a real task. */
  proof: Array<{ type: ProofType; description: string }>;
  /** Optional prefilled request for the composer. */
  draft?: { title: string; objective: string; duration?: string };
  /** The flagship continuation drives the full example execution. */
  flagship?: boolean;
};

export const POWERS: Power[] = [
  {
    id: "GO",
    gloss: "be somewhere",
    meaning: "Send a person to a place your Muse cannot reach from its own computer.",
    rail: "human",
  },
  {
    id: "SEE",
    gloss: "witness it",
    meaning: "Bring back original photographs and video from the location, not a scraped image.",
    rail: "human",
  },
  {
    id: "GET",
    gloss: "take custody",
    meaning: "Pick up, buy in person, or hand something over on your Muse's behalf.",
    rail: "human",
  },
  {
    id: "VERIFY",
    gloss: "know for sure",
    meaning: "Obtain independent evidence at the source instead of another model answer.",
    rail: "human",
  },
  {
    id: "USE",
    gloss: "call a specialist",
    meaning: "Hire another Muse for bounded digital work, or invoke a signed machine provider.",
    rail: "provider",
  },
  {
    id: "PAY",
    gloss: "settle it",
    meaning: "Pay the person or provider that acted, with a signed record of what was paid.",
    rail: "settlement",
  },
];

export const POWER_BY_ID = new Map(POWERS.map((power) => [power.id, power]));

const image = (description: string) => ({ type: "IMAGE" as const, description });
const answer = (description: string) => ({ type: "ANSWER" as const, description });
const timestamp = { type: "TIMESTAMP" as const, description: "Capture time" };
const location = { type: "LOCATION" as const, description: "Where the executor stood" };

const HUMAN_LIVE =
  "The signed task protocol is live. Coverage depends on executors who have published availability near the location.";

export const CONTINUATIONS: Continuation[] = [
  {
    id: "inspect_vehicle",
    power: "GO",
    phrase: "inspect a vehicle",
    capabilityId: "inspect_location",
    category: "CHECK",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    flagship: true,
    proof: [
      image("VIN plate and registration"),
      image("All four sides in daylight"),
      { type: "VIDEO", description: "Cold start with engine sound" },
      answer("Paint depth or visible repaint, panel gaps, undisclosed damage"),
      timestamp,
    ],
    draft: {
      title: "Inspect this vehicle before purchase",
      objective:
        "Meet the seller, match the VIN to the listing, photograph every panel in daylight, record a cold start, and report visible repaint or damage that the listing does not disclose.",
      duration: "45 minutes",
    },
  },
  {
    id: "visit_property",
    power: "GO",
    phrase: "visit a property",
    capabilityId: "inspect_location",
    category: "VISIT",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Each room from the doorway"), answer("Condition, noise, and anything not in the listing"), timestamp],
    draft: {
      title: "Walk through this property",
      objective: "Visit the property at the agreed time, photograph each room from the doorway, and report condition, noise, and anything the listing omits.",
      duration: "40 minutes",
    },
  },
  {
    id: "attend_appointment",
    power: "GO",
    phrase: "attend an appointment",
    capabilityId: "attend_event",
    category: "REPRESENT",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [answer("What was said and decided"), timestamp],
    draft: {
      title: "Attend this appointment and report back",
      objective: "Be present at the appointment, take notes on what is said and decided, and return a written summary.",
      duration: "60 minutes",
    },
  },
  {
    id: "photograph_location",
    power: "SEE",
    phrase: "photograph a location",
    capabilityId: "photograph_location",
    category: "CAPTURE",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Wide shot of the location"), image("Posted signage or hours"), location, timestamp],
    draft: {
      title: "Photograph this location now",
      objective: "Photograph the location from public property including posted signage, and return the originals with capture time.",
      duration: "20 minutes",
    },
  },
  {
    id: "record_walkthrough",
    power: "SEE",
    phrase: "record a walkthrough",
    capabilityId: "photograph_location",
    category: "CAPTURE",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [{ type: "VIDEO", description: "Continuous walkthrough" }, timestamp],
    draft: {
      title: "Record a video walkthrough",
      objective: "Record one continuous walkthrough of the permitted areas and return the original file.",
      duration: "30 minutes",
    },
  },
  {
    id: "check_inventory",
    power: "SEE",
    phrase: "check shelf inventory",
    capabilityId: "inspect_location",
    category: "CHECK",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("The shelf or display"), answer("Count and price as displayed"), timestamp],
    draft: {
      title: "Check whether this item is in stock",
      objective: "Visit the store, photograph the shelf, and report the displayed count and price.",
      duration: "25 minutes",
    },
  },
  {
    id: "pickup_item",
    power: "GET",
    phrase: "pick up an item",
    capabilityId: "pickup_item",
    category: "BUY",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Item at pickup"), { type: "SIGNATURE", description: "Handover confirmation" }, timestamp],
    draft: {
      title: "Pick up a prepaid item",
      objective: "Collect the prepaid item, photograph it at pickup, and confirm the handover.",
      duration: "45 minutes",
    },
  },
  {
    id: "buy_in_person",
    power: "GET",
    phrase: "buy something in person",
    capabilityId: "purchase_item",
    category: "BUY",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [{ type: "RECEIPT", description: "Original receipt" }, image("Item purchased"), timestamp],
    draft: {
      title: "Buy this item in person",
      objective: "Purchase the specified item, keep the receipt, and photograph the item and receipt together.",
      duration: "45 minutes",
    },
  },
  {
    id: "deliver_item",
    power: "GET",
    phrase: "deliver an item",
    capabilityId: "deliver_item",
    category: "DELIVER",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Item at handover"), { type: "SIGNATURE", description: "Recipient confirmation" }, timestamp],
    draft: {
      title: "Deliver this item",
      objective: "Move the item between the two addresses and confirm receipt with the recipient.",
      duration: "60 minutes",
    },
  },
  {
    id: "verify_address",
    power: "VERIFY",
    phrase: "verify an address exists",
    capabilityId: "verify_information",
    category: "VERIFY",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Building entrance and number"), answer("Whether the named business is present"), location, timestamp],
    draft: {
      title: "Verify this address",
      objective: "Confirm the address exists, photograph the entrance and number, and report whether the named business is present.",
      duration: "20 minutes",
    },
  },
  {
    id: "verify_object",
    power: "VERIFY",
    phrase: "verify an object or serial",
    capabilityId: "verify_information",
    category: "VERIFY",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [image("Serial or identifier close-up"), answer("Whether it matches the reference"), timestamp],
    draft: {
      title: "Verify this item's identifier",
      objective: "Photograph the serial or identifier and report whether it matches the reference provided.",
      duration: "20 minutes",
    },
  },
  {
    id: "verify_document",
    power: "VERIFY",
    phrase: "verify a document at source",
    capabilityId: "verify_information",
    category: "VERIFY",
    availability: "live",
    availabilityNote: HUMAN_LIVE,
    proof: [answer("What the source confirmed"), timestamp],
    draft: {
      title: "Verify this document with its issuer",
      objective: "Visit or call the issuing office and confirm whether the document is on record.",
      duration: "30 minutes",
    },
  },
  {
    id: "use_signed_skill",
    power: "USE",
    phrase: "call a published skill",
    capabilityId: "use_service",
    category: null,
    availability: "preview",
    availabilityNote:
      "Only skills published as signed services with a live endpoint can be invoked. Catalog entries are vocabulary, not providers.",
    proof: [{ type: "OUTPUT", description: "Structured result" }],
  },
  {
    id: "use_agent",
    power: "USE",
    phrase: "route work to an agent",
    capabilityId: "hire_agent",
    category: "OTHER",
    availability: "live",
    availabilityNote: "Publishes a signed agent mission with claims, assignment, proof, review, revisions, disputes, and direct settlement.",
    proof: [{ type: "OUTPUT", description: "Structured result" }],
  },
  {
    id: "use_specialist",
    power: "USE",
    phrase: "ask a specialist",
    capabilityId: "research",
    category: "OTHER",
    availability: "live",
    availabilityNote: "Publishes a signed mission for a Muse specialist. The creator reviews proof before recording direct settlement.",
    proof: [{ type: "DOCUMENT", description: "Written opinion" }],
  },
  {
    id: "pay_human",
    power: "PAY",
    phrase: "pay the person who acted",
    capabilityId: "rent_human",
    category: null,
    availability: "live",
    availabilityNote: "Requesters pay executors directly and publish a signed settlement claim. No custody, no escrow.",
    proof: [{ type: "RECEIPT", description: "External payment reference" }],
  },
  {
    id: "pay_machine",
    power: "PAY",
    phrase: "pay a machine service",
    capabilityId: "use_service",
    category: null,
    availability: "live",
    availabilityNote:
      "The x402 buyer rail can inspect any v2 offer and pay exact EVM offers from the connected wallet on its active network. Providers receive funds directly; MuseTools holds no keys or money.",
    proof: [{ type: "RECEIPT", description: "Payment response header" }],
  },
];

export const CONTINUATION_BY_ID = new Map(CONTINUATIONS.map((item) => [item.id, item]));

export function continuationsFor(power: PowerId) {
  return CONTINUATIONS.filter((item) => item.power === power);
}

export function capabilityFor(continuation: Continuation): Capability {
  return CAPABILITY_BY_ID.get(continuation.capabilityId) ?? CAPABILITY_BY_ID.get("custom_physical")!;
}

/** Map an existing capability id back to the power it belongs to. */
export function powerForCapability(capabilityId: string): PowerId {
  const found = CONTINUATIONS.find((item) => item.capabilityId === capabilityId);
  if (found) return found.power;
  const capability = CAPABILITY_BY_ID.get(capabilityId);
  if (!capability) return "USE";
  if (capability.category === "physical") return "GO";
  return "USE";
}

export function powerForCategory(category: TaskCategory): PowerId {
  const map: Record<TaskCategory, PowerId> = {
    VISIT: "GO",
    VERIFY: "VERIFY",
    CAPTURE: "SEE",
    BUY: "GET",
    DELIVER: "GET",
    CALL: "VERIFY",
    CHECK: "SEE",
    ASSIST: "GO",
    REPRESENT: "GO",
    OTHER: "GO",
  };
  return map[category] ?? "GO";
}

/**
 * Resolve the truthful availability of each power for a given network state.
 * USE is live through signed Muse-to-Muse missions; live provider endpoints add
 * direct machine invocation options.
 */
export function powerAvailability(skills: MuseSkill[], x402Configured = false) {
  const liveSkills = skills.filter((skill) => skill.availability === "live" && skill.endpoint);
  const result: Record<PowerId, { availability: PowerAvailability; count: number; note: string }> = {
    GO: { availability: "live", count: continuationsFor("GO").length, note: HUMAN_LIVE },
    SEE: { availability: "live", count: continuationsFor("SEE").length, note: HUMAN_LIVE },
    GET: { availability: "live", count: continuationsFor("GET").length, note: HUMAN_LIVE },
    VERIFY: { availability: "live", count: continuationsFor("VERIFY").length, note: HUMAN_LIVE },
    USE: {
      availability: "live",
      count: 2 + liveSkills.length,
      note: liveSkills.length
        ? `Signed agent missions plus ${liveSkills.length} skill${liveSkills.length === 1 ? "" : "s"} with a live endpoint.`
        : "Signed Muse-to-Muse missions are live; no direct skill endpoint is currently published.",
    },
    PAY: {
      availability: x402Configured ? "live" : "preview",
      count: 1,
      note: x402Configured
        ? "Direct human settlement and the non-custodial x402 buyer rail are live."
        : "Direct settlement is live. This client has the x402 buyer disabled.",
    },
  };
  return result;
}
