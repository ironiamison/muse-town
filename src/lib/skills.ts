import type { PortService } from "./economy.js";
import type { JsonSchema } from "./capabilities.js";

export type SkillAvailability = "live" | "preview" | "unavailable";

export type SkillAction = {
  id: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
};

export type MuseSkill = {
  id: string;
  name: string;
  description: string;
  category:
    | "research"
    | "shopping"
    | "vision"
    | "translation"
    | "data"
    | "travel"
    | "search"
    | "analysis"
    | "content"
    | "monitoring"
    | "commerce"
    | "code";
  actions: SkillAction[];
  pricing: {
    model: "free" | "per_call" | "provider_quote";
    amount: number | null;
    currency: string;
  };
  provider: {
    id: string;
    name: string;
    verified: boolean;
  } | null;
  reputation: {
    invocations: number;
    successRate: number | null;
  };
  availability: SkillAvailability;
  endpoint: string | null;
  source: "catalog" | "signed_service";
};

const textInput: JsonSchema = {
  type: "object",
  required: ["query"],
  properties: { query: { type: "string" }, context: { type: "object" } },
};

const resultOutput: JsonSchema = {
  type: "object",
  required: ["result"],
  properties: {
    result: { type: "object" },
    sources: { type: "array", items: { type: "string" } },
  },
};

function action(id: string, description: string): SkillAction {
  return {
    id,
    name: id.replaceAll("_", " "),
    description,
    inputSchema: textInput,
    outputSchema: resultOutput,
  };
}

function catalogSkill(
  id: MuseSkill["category"],
  description: string,
  actions: Array<[string, string]>,
): MuseSkill {
  return {
    id,
    name: id[0].toUpperCase() + id.slice(1),
    description,
    category: id,
    actions: actions.map(([actionId, actionDescription]) =>
      action(actionId, actionDescription),
    ),
    pricing: { model: "provider_quote", amount: null, currency: "USD" },
    provider: null,
    reputation: { invocations: 0, successRate: null },
    availability: "preview",
    endpoint: null,
    source: "catalog",
  };
}

/**
 * Capability definitions are discoverable product vocabulary, not claims that
 * a live provider exists. A catalog skill becomes live only when a compatible
 * signed service declaration is present.
 */
export const SKILL_CATALOG: MuseSkill[] = [
  catalogSkill("research", "Find, compare, and synthesize trustworthy information.", [
    ["search_web", "Search public web sources."],
    ["research_topic", "Produce a sourced research brief."],
    ["compare_sources", "Compare claims across supplied sources."],
    ["summarize_findings", "Return a structured summary."],
    ["monitor_topic", "Watch a topic for meaningful changes."],
  ]),
  catalogSkill("shopping", "Find, compare, purchase, and follow products.", [
    ["compare_products", "Compare products against supplied criteria."],
    ["find_product", "Locate a matching product."],
    ["check_inventory", "Check digital or human-assisted availability."],
    ["purchase", "Purchase through a configured payment rail."],
    ["track_order", "Track a known order."],
  ]),
  catalogSkill("vision", "Understand images, documents, and visual evidence.", [
    ["describe_image", "Describe relevant visual content."],
    ["extract_text", "Read text from an image or scan."],
    ["compare_images", "Compare supplied images."],
    ["inspect_proof", "Evaluate submitted execution proof."],
  ]),
  catalogSkill("translation", "Translate and localize language while preserving meaning.", [
    ["translate_text", "Translate supplied text."],
    ["detect_language", "Identify a language."],
    ["localize_content", "Adapt content for a locale."],
  ]),
  catalogSkill("data", "Transform, validate, and enrich structured data.", [
    ["transform_data", "Transform data to a target schema."],
    ["validate_records", "Validate records against constraints."],
    ["enrich_records", "Add permitted sourced attributes."],
    ["classify_records", "Classify records using supplied labels."],
  ]),
  catalogSkill("travel", "Plan and monitor routes, stays, and travel constraints.", [
    ["plan_trip", "Create a constraint-aware itinerary."],
    ["compare_routes", "Compare available routes."],
    ["find_stay", "Find lodging matching criteria."],
    ["monitor_trip", "Monitor known travel plans for changes."],
  ]),
  catalogSkill("search", "Find matching resources across declared sources.", [
    ["search_sources", "Search configured sources."],
    ["rank_results", "Rank supplied results against criteria."],
    ["find_entity", "Find a matching public entity."],
  ]),
  catalogSkill("analysis", "Turn documents and data into structured findings.", [
    ["analyze_documents", "Analyze supplied documents."],
    ["compare_options", "Compare options against a rubric."],
    ["extract_findings", "Extract structured findings."],
  ]),
  catalogSkill("content", "Create and adapt bounded digital content.", [
    ["draft_content", "Draft content from a brief."],
    ["rewrite_content", "Rewrite supplied content."],
    ["format_content", "Format content for a target channel."],
  ]),
  catalogSkill("monitoring", "Observe declared sources and report useful changes.", [
    ["monitor_source", "Monitor a source for changes."],
    ["create_alert", "Create a condition-based alert."],
    ["summarize_changes", "Summarize observed changes."],
  ]),
  catalogSkill("commerce", "Discover paid machine resources and request purchase.", [
    ["discover_paid_resource", "Find a compatible paid resource."],
    ["quote_resource", "Read machine-readable price requirements."],
    ["purchase_resource", "Purchase using a configured payment adapter."],
  ]),
  catalogSkill("code", "Create, inspect, and transform software artifacts.", [
    ["inspect_code", "Inspect supplied source code."],
    ["generate_patch", "Generate a bounded patch."],
    ["run_check", "Run a declared verification check."],
  ]),
];

const serviceCategory: Record<string, MuseSkill["category"]> = {
  RESEARCH: "research",
  CODING: "code",
  DATA: "data",
  MONITORING: "monitoring",
  MARKET_INTELLIGENCE: "analysis",
  AUTOMATION: "data",
  MEDIA: "content",
  OTHER: "analysis",
};

export function serviceAsSkill(service: PortService): MuseSkill {
  const category = serviceCategory[service.category] ?? "analysis";
  return {
    id: service.ref.toLowerCase(),
    name: service.title,
    description: service.description,
    category,
    actions: [
      action(
        service.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ||
          "invoke",
        service.description,
      ),
    ],
    pricing: {
      model: service.price === null ? "provider_quote" : "per_call",
      amount: service.price,
      currency: service.asset || "USD",
    },
    provider: {
      id: service.provider.museId,
      name: service.provider.name,
      verified: Boolean(service.provider.verified),
    },
    reputation: { invocations: service.uses, successRate: null },
    availability: service.availability ? "live" : "unavailable",
    endpoint: service.endpoint || null,
    source: "signed_service",
  };
}

export function mergeSkills(services: PortService[]) {
  const signed = services.map(serviceAsSkill);
  const signedCategories = new Set(signed.map((skill) => skill.category));
  return [
    ...signed,
    ...SKILL_CATALOG.map((skill) =>
      signedCategories.has(skill.category)
        ? { ...skill, availability: "preview" as const }
        : skill,
    ),
  ];
}

export function publicSkill(skill: MuseSkill) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    actions: skill.actions.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      input_schema: item.inputSchema,
      output_schema: item.outputSchema,
    })),
    pricing: skill.pricing,
    provider: skill.provider,
    reputation: {
      invocations: skill.reputation.invocations,
      success_rate: skill.reputation.successRate,
    },
    availability: skill.availability,
    endpoint: skill.endpoint,
    source: skill.source,
  };
}
