import type { ProofType, TaskCategory } from "./port.js";

export type ExecutorType = "human" | "agent" | "service" | "business" | "device" | "api";
export type CapabilityCategory = "physical" | "digital" | "network";
export type CapabilityAvailability = "live" | "experimental" | "planned";

export type JsonSchema = {
  type: string;
  description?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
};

export type Capability = {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  executorTypes: ExecutorType[];
  geographicConstraints: "location_required" | "location_optional" | "none";
  estimatedPrice: { minimum: number | null; currency: string; model: string };
  estimatedDuration: string;
  proofTypes: ProofType[];
  availability: CapabilityAvailability;
  reputationRequirements: string[];
  portCategories: TaskCategory[];
  example: string;
};

const locationSchema: JsonSchema = {
  type: "object",
  description: "Where the outcome must be executed.",
  required: ["city", "country"],
  properties: {
    city: { type: "string" },
    country: { type: "string" },
    area: { type: "string" },
    address: { type: "string" },
  },
};

const instructionsSchema: JsonSchema = {
  type: "string",
  description: "A bounded, lawful description of the requested outcome.",
};

const digitalOutput: JsonSchema = {
  type: "object",
  required: ["result", "completed_at"],
  properties: {
    result: { type: "object" },
    completed_at: { type: "string" },
    executor_note: { type: "string" },
  },
};

function physicalCapability(
  capability: Omit<
    Capability,
    | "category"
    | "inputSchema"
    | "outputSchema"
    | "executorTypes"
    | "geographicConstraints"
    | "availability"
    | "reputationRequirements"
  > & {
    inputExtras?: Record<string, JsonSchema>;
    reputationRequirements?: string[];
  },
): Capability {
  return {
    ...capability,
    category: "physical",
    inputSchema: {
      type: "object",
      required: ["location", "instructions"],
      properties: {
        location: locationSchema,
        instructions: instructionsSchema,
        ...capability.inputExtras,
      },
    },
    outputSchema: {
      type: "object",
      required: ["task_id", "status"],
      properties: {
        task_id: { type: "string" },
        status: { type: "string" },
        executor: { type: "object" },
        proof: { type: "array", items: { type: "object" } },
        structured_result: { type: "object" },
      },
    },
    executorTypes: ["human", "business"],
    geographicConstraints: "location_required",
    availability: "live",
    reputationRequirements: capability.reputationRequirements ?? [],
  };
}

function digitalCapability(
  capability: Omit<
    Capability,
    | "category"
    | "inputSchema"
    | "outputSchema"
    | "executorTypes"
    | "geographicConstraints"
    | "availability"
    | "reputationRequirements"
  >,
): Capability {
  return {
    ...capability,
    category: "digital",
    inputSchema: {
      type: "object",
      required: ["instructions"],
      properties: { instructions: instructionsSchema, input: { type: "object" } },
    },
    outputSchema: digitalOutput,
    executorTypes: ["agent", "service", "api"],
    geographicConstraints: "none",
    availability: "experimental",
    reputationRequirements: [],
  };
}

export const CAPABILITIES: Capability[] = [
  physicalCapability({
    id: "photograph_location",
    name: "Photograph",
    description: "Capture current, on-location visual evidence.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "15–90 minutes after claim",
    proofTypes: ["IMAGE", "TIMESTAMP", "LOCATION"],
    portCategories: ["CAPTURE"],
    example: "Photograph the storefront and its posted opening hours.",
  }),
  physicalCapability({
    id: "inspect_location",
    name: "Inspect",
    description: "Observe a place or item and return structured findings.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "30–120 minutes after claim",
    proofTypes: ["IMAGE", "ANSWER", "TIMESTAMP"],
    portCategories: ["CHECK"],
    example: "Inspect this used car and document visible damage.",
  }),
  physicalCapability({
    id: "purchase_item",
    name: "Purchase",
    description: "Buy a permitted item that requires physical presence.",
    estimatedPrice: { minimum: null, currency: "USD", model: "reward_plus_expenses" },
    estimatedDuration: "30 minutes–24 hours",
    proofTypes: ["RECEIPT", "IMAGE", "TIMESTAMP"],
    portCategories: ["BUY"],
    example: "Buy this magazine and keep the receipt.",
  }),
  physicalCapability({
    id: "pickup_item",
    name: "Pickup",
    description: "Collect a permitted item from a specified location.",
    estimatedPrice: { minimum: null, currency: "USD", model: "reward_plus_expenses" },
    estimatedDuration: "30 minutes–4 hours",
    proofTypes: ["IMAGE", "SIGNATURE", "TIMESTAMP"],
    portCategories: ["BUY", "ASSIST"],
    example: "Pick up the prepaid parcel before the store closes.",
  }),
  physicalCapability({
    id: "deliver_item",
    name: "Deliver",
    description: "Move a permitted item between two locations.",
    inputExtras: {
      destination: { ...locationSchema, description: "Where the item must be delivered." },
    },
    estimatedPrice: { minimum: null, currency: "USD", model: "reward_plus_expenses" },
    estimatedDuration: "45 minutes–24 hours",
    proofTypes: ["IMAGE", "SIGNATURE", "TIMESTAMP"],
    portCategories: ["DELIVER"],
    example: "Deliver these flowers and confirm receipt.",
  }),
  physicalCapability({
    id: "verify_information",
    name: "Verify",
    description: "Confirm a real-world fact at its source.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "15–90 minutes after claim",
    proofTypes: ["ANSWER", "IMAGE", "TIMESTAMP"],
    portCategories: ["VERIFY"],
    example: "Verify that this address and business entrance exist.",
  }),
  physicalCapability({
    id: "attend_event",
    name: "Attend",
    description: "Attend a permitted event or appointment and report back.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "Event duration",
    proofTypes: ["ANSWER", "IMAGE", "TIMESTAMP"],
    portCategories: ["VISIT", "REPRESENT"],
    example: "Attend the public talk and summarize the announced changes.",
  }),
  physicalCapability({
    id: "make_call",
    name: "Call",
    description: "Make a permitted phone inquiry and return the answer.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "10–45 minutes after claim",
    proofTypes: ["ANSWER", "TIMESTAMP"],
    portCategories: ["CALL"],
    example: "Ask whether this store has the specified item in stock.",
  }),
  physicalCapability({
    id: "custom_physical",
    name: "Custom task",
    description: "Request a safe, bounded physical-world outcome.",
    estimatedPrice: { minimum: null, currency: "USD", model: "executor_quote" },
    estimatedDuration: "Depends on request",
    proofTypes: ["CONFIRM", "TIMESTAMP"],
    portCategories: ["ASSIST", "OTHER"],
    example: "Describe the outcome, constraints, budget, and required proof.",
  }),
  digitalCapability({
    id: "research",
    name: "Research",
    description: "Route a bounded research question to an agent or specialist.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on request",
    proofTypes: ["OUTPUT", "DOCUMENT"],
    portCategories: ["OTHER"],
    example: "Compare the public filings and return a sourced brief.",
  }),
  digitalCapability({
    id: "analyze",
    name: "Analyze",
    description: "Analyze supplied documents or structured data.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on input",
    proofTypes: ["OUTPUT", "DOCUMENT"],
    portCategories: ["OTHER"],
    example: "Analyze these documents and return structured findings.",
  }),
  digitalCapability({
    id: "generate",
    name: "Generate",
    description: "Create a specified digital artifact.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on request",
    proofTypes: ["OUTPUT"],
    portCategories: ["OTHER"],
    example: "Generate a compliant export from this structured input.",
  }),
  digitalCapability({
    id: "monitor",
    name: "Monitor",
    description: "Watch a source or condition and report meaningful changes.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Continuous or scheduled",
    proofTypes: ["OUTPUT", "TIMESTAMP"],
    portCategories: ["OTHER"],
    example: "Monitor this public page and report material updates.",
  }),
  digitalCapability({
    id: "search",
    name: "Search",
    description: "Search permitted sources and return structured results.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on scope",
    proofTypes: ["OUTPUT"],
    portCategories: ["OTHER"],
    example: "Find matching public records and return links with excerpts.",
  }),
  digitalCapability({
    id: "process_data",
    name: "Process data",
    description: "Transform, classify, enrich, or validate structured data.",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on volume",
    proofTypes: ["OUTPUT", "DOCUMENT"],
    portCategories: ["OTHER"],
    example: "Normalize these records to the supplied schema.",
  }),
  {
    id: "rent_human",
    name: "Rent a human",
    description: "Route a physical-world outcome to an available human executor.",
    category: "network",
    inputSchema: {
      type: "object",
      required: ["location", "task", "budget", "proof_required"],
      properties: {
        capability: { type: "string" },
        task: instructionsSchema,
        location: locationSchema,
        budget: { type: "object" },
        deadline: { type: "string" },
        proof_required: { type: "array", items: { type: "string" } },
      },
    },
    outputSchema: {
      type: "object",
      required: ["task_id", "status"],
      properties: {
        task_id: { type: "string" },
        status: { type: "string" },
        executor: { type: "object" },
        proof: { type: "array", items: { type: "object" } },
        structured_result: { type: "object" },
      },
    },
    executorTypes: ["human"],
    geographicConstraints: "location_optional",
    estimatedPrice: { minimum: null, currency: "USD", model: "task_budget" },
    estimatedDuration: "Depends on capability and coverage",
    proofTypes: ["IMAGE", "VIDEO", "LOCATION", "TIMESTAMP", "RECEIPT", "ANSWER"],
    availability: "live",
    reputationRequirements: [],
    portCategories: ["VISIT", "VERIFY", "CAPTURE", "BUY", "DELIVER", "CALL", "CHECK", "ASSIST", "REPRESENT", "OTHER"],
    example: "Create a physical task and let a local executor claim it.",
  },
  {
    id: "hire_agent",
    name: "Hire an agent",
    description: "Route a digital outcome to a compatible agent.",
    category: "network",
    inputSchema: {
      type: "object",
      required: ["capability", "instructions", "budget"],
      properties: {
        capability: { type: "string" },
        instructions: instructionsSchema,
        input: { type: "object" },
        budget: { type: "object" },
      },
    },
    outputSchema: digitalOutput,
    executorTypes: ["agent"],
    geographicConstraints: "none",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Depends on capability",
    proofTypes: ["OUTPUT", "DOCUMENT", "CODE"],
    availability: "experimental",
    reputationRequirements: [],
    portCategories: ["OTHER"],
    example: "Route a structured research task to a compatible agent.",
  },
  {
    id: "use_service",
    name: "Use a service",
    description: "Invoke a compatible service or API for a defined outcome.",
    category: "network",
    inputSchema: {
      type: "object",
      required: ["service", "input"],
      properties: {
        service: { type: "string" },
        input: { type: "object" },
        maximum_price: { type: "object" },
      },
    },
    outputSchema: digitalOutput,
    executorTypes: ["service", "api"],
    geographicConstraints: "none",
    estimatedPrice: { minimum: null, currency: "USD", model: "provider_quote" },
    estimatedDuration: "Provider-defined",
    proofTypes: ["OUTPUT"],
    availability: "experimental",
    reputationRequirements: [],
    portCategories: ["OTHER"],
    example: "Invoke a declared service endpoint using its published schema.",
  },
];

export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map((capability) => [capability.id, capability]));

export function findCapabilityForTask(category: TaskCategory) {
  return (
    CAPABILITIES.find(
      (capability) =>
        capability.category === "physical" &&
        capability.portCategories.includes(category) &&
        capability.id !== "rent_human",
    ) ?? CAPABILITY_BY_ID.get("custom_physical")!
  );
}

export function publicCapability(capability: Capability) {
  return {
    id: capability.id,
    name: capability.name,
    description: capability.description,
    category: capability.category,
    input_schema: capability.inputSchema,
    output_schema: capability.outputSchema,
    executor_types: capability.executorTypes,
    geographic_constraints: capability.geographicConstraints,
    estimated_price: capability.estimatedPrice,
    estimated_duration: capability.estimatedDuration,
    proof_types: capability.proofTypes.map((proof) => proof.toLowerCase()),
    availability: capability.availability,
    reputation_requirements: capability.reputationRequirements,
    example: capability.example,
  };
}
