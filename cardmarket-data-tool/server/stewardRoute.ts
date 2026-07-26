import { stewardPlanRequestSchema, stewardResponseSchema } from "../src/steward/schemas";
import type { BatchGroupingField, StewardPlan, StewardPlanRequest, StewardResponse } from "../src/steward/models";
import {
  ConfigError,
  getStewardProviderConfig,
  STEWARD_MAX_TOKENS,
  STEWARD_PROMPT_CACHE_ENABLED,
  STEWARD_PROMPT_CACHE_TTL,
  STEWARD_PROVIDER_TIMEOUT_MS,
} from "./stewardConfig";
import { stewardSystemPrompt } from "./stewardSystemPrompt";

const externalDataPatterns = [
  /current .*price/i,
  /market price/i,
  /cardmarket price/i,
  /spiked/i,
  /recent sales/i,
  /scrape/i,
  /market values/i,
];

export async function handleStewardPlan(rawBody: unknown): Promise<{ status: number; body: unknown }> {
  const parsedRequest = stewardPlanRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return safeError(400, "Invalid Steward request.");
  }

  const request = parsedRequest.data as StewardPlanRequest;
  if (externalDataPatterns.some((pattern) => pattern.test(request.request))) {
    return {
      status: 200,
      body: {
        type: "unsupported",
        reason: "external_data_required",
        message: "This request requires external market data and belongs to the planned research-agent phase.",
      } satisfies StewardResponse,
    };
  }

  try {
    const config = getStewardProviderConfig();
    const response = await callAnthropicForPlan(request, config);
    const normalizedResponse = normalizeStewardResponse(response, request);
    const parsedResponse = stewardResponseSchema.safeParse(normalizedResponse);
    if (!parsedResponse.success) {
      console.warn("Invalid Steward structured response", parsedResponse.error.flatten());
      const fallback = fallbackPlanForPrimarySplitRequest(
        request,
        "The Steward used the safe local fallback because the model response did not match the required schema.",
      );
      if (fallback) {
        return { status: 200, body: fallback };
      }
      return safeError(502, "CSV Steward received an invalid structured response.");
    }
    return { status: 200, body: parsedResponse.data };
  } catch (caught) {
    const fallback = fallbackPlanForPrimarySplitRequest(
      request,
      "The Steward used the safe local fallback because the AI provider was unavailable for this request.",
    );
    if (fallback) {
      const message = caught instanceof Error ? caught.message : "Unknown provider error.";
      console.warn("Steward provider unavailable; using deterministic fallback", message);
      return { status: 200, body: fallback };
    }

    if (caught instanceof ConfigError) {
      return safeError(503, caught.message);
    }

    const message = caught instanceof Error ? caught.message : "CSV Steward failed.";
    if (/401|auth/i.test(message)) return safeError(502, "Anthropic authentication failed.");
    if (/429|rate/i.test(message)) return safeError(429, "Anthropic rate limit reached.");
    if (/timeout|abort/i.test(message)) return safeError(504, "Anthropic request timed out.");
    return safeError(500, "CSV Steward could not create a plan.");
  }
}

async function callAnthropicForPlan(
  request: StewardPlanRequest,
  config: { apiKey: string; model: string },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEWARD_PROVIDER_TIMEOUT_MS);
  try {
    const anthropicModule = await import("@anthropic-ai/sdk");
    const Anthropic = anthropicModule.default;
    const client = new Anthropic({ apiKey: config.apiKey });

    const message = await client.messages.create(
      {
        model: config.model,
        max_tokens: STEWARD_MAX_TOKENS,
        system: buildCachedSystemPrompt(),
        tools: [
          {
            name: "propose_steward_response",
            description: "Return one validated CSV Steward response.",
            input_schema: stewardToolInputSchema(),
          },
        ],
        tool_choice: { type: "tool", name: "propose_steward_response" },
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              userRequest: request.request,
              scope: request.scope,
              collectionContext: request.context,
              supportedOperations: [
                "set_view_filter",
                "sort",
                "set_field",
                "adjust_number",
                "round_number",
                "remove_records",
                "transfer_records",
                "create_batches",
                "split_collection",
                "prepare_export",
              ],
            }),
          },
        ],
      },
      { signal: controller.signal },
    );

    const toolUse = message.content.find((part) => part.type === "tool_use" && part.name === "propose_steward_response");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No structured tool response returned.");
    }
    return toolUse.input;
  } finally {
    clearTimeout(timeout);
  }
}

function stewardToolInputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { enum: ["plan", "clarification", "unsupported"] },
      plan: stewardPlanJsonSchema(),
      question: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      message: { type: "string" },
      reason: {
        enum: ["external_data_required", "operation_not_supported", "ambiguous_request", "unsafe_request"],
      },
    },
    required: ["type"],
  };
}

function stewardPlanJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      userRequest: { type: "string" },
      operations: {
        type: "array",
        minItems: 1,
        items: operationJsonSchema(),
      },
      warnings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
          required: ["code", "message"],
        },
      },
      assumptions: { type: "array", items: { type: "string" } },
    },
    required: ["id", "title", "summary", "userRequest", "operations", "warnings", "assumptions"],
  };
}

function operationJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { enum: ["split_collection", "create_batches", "set_view_filter"] },
      source: { enum: ["all", "filtered", "selected"] },
      predicate: predicateJsonSchema(),
      groupBy: {
        type: "array",
        minItems: 1,
        items: { enum: ["setCode", "setName", "rarity", "finish", "language", "condition"] },
      },
      maximumRows: { type: "integer", minimum: 1, maximum: 100 },
      namingTemplate: { type: "string" },
      cardmarketMode: { type: "boolean" },
      mode: { enum: ["copy", "move"] },
      sortBy: {
        type: "array",
        items: sortRuleJsonSchema(),
      },
      separateFiles: { type: "boolean" },
    },
    required: ["type"],
  };
}

function sortRuleJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      field: {
        enum: [
          "name",
          "setCode",
          "setName",
          "collectorNumber",
          "finish",
          "rarity",
          "quantity",
          "condition",
          "language",
          "purchasePrice",
          "targetPrice",
        ],
      },
      direction: { enum: ["asc", "desc"] },
    },
    required: ["field", "direction"],
  };
}

function predicateJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { enum: ["all", "selected", "currently_filtered", "condition"] },
      field: {
        enum: [
          "name",
          "setCode",
          "setName",
          "collectorNumber",
          "finish",
          "rarity",
          "quantity",
          "purchasePrice",
          "purchasePriceCurrency",
          "condition",
          "language",
          "targetPrice",
          "notes",
        ],
      },
      operator: {
        enum: [
          "equals",
          "not_equals",
          "contains",
          "starts_with",
          "ends_with",
          "in",
          "not_in",
          "less_than",
          "less_than_or_equal",
          "greater_than",
          "greater_than_or_equal",
          "is_empty",
          "is_not_empty",
        ],
      },
      value: {},
    },
    required: ["type"],
  };
}

function buildCachedSystemPrompt() {
  const text = stewardSystemPrompt();
  if (!STEWARD_PROMPT_CACHE_ENABLED) {
    return text;
  }

  return [
    {
      type: "text",
      text,
      cache_control: {
        type: "ephemeral",
        ttl: STEWARD_PROMPT_CACHE_TTL,
      },
    },
  ];
}

function safeError(status: number, message: string): { status: number; body: { message: string } } {
  return { status, body: { message } };
}

function normalizeStewardResponse(rawResponse: unknown, request: StewardPlanRequest): unknown {
  if (!isRecord(rawResponse)) {
    return rawResponse;
  }

  if (rawResponse.type === "plan" && isRecord(rawResponse.plan)) {
    return {
      ...rawResponse,
      plan: normalizePlanObject(rawResponse.plan, request),
    };
  }

  if (rawResponse.type === "plan" && Array.isArray(rawResponse.operations)) {
    return {
      type: "plan",
      plan: normalizePlanObject(rawResponse, request),
    };
  }

  if (rawResponse.type === "unsupported" && typeof rawResponse.message === "string") {
    return {
      ...rawResponse,
      reason: isUnsupportedReason(rawResponse.reason) ? rawResponse.reason : "operation_not_supported",
    };
  }

  if (isStewardResponseType(rawResponse.type)) {
    return rawResponse;
  }

  if (isRecord(rawResponse.plan)) {
    return { ...rawResponse, type: "plan" };
  }

  if (Array.isArray(rawResponse.operations)) {
    return {
      type: "plan",
      plan: normalizePlanObject(rawResponse, request),
    };
  }

  if (isStewardOperationType(rawResponse.type)) {
    return {
      type: "plan",
      plan: normalizePlanObject({ operations: [rawResponse] }, request),
    };
  }

  if (typeof rawResponse.question === "string") {
    return {
      ...rawResponse,
      type: "clarification",
    };
  }

  if (typeof rawResponse.message === "string") {
    return {
      ...rawResponse,
      type: "unsupported",
      reason: isUnsupportedReason(rawResponse.reason) ? rawResponse.reason : "operation_not_supported",
    };
  }

  return rawResponse;
}

function normalizePlanObject(rawPlan: Record<string, unknown>, request: StewardPlanRequest): Record<string, unknown> {
  const operations = Array.isArray(rawPlan.operations)
    ? rawPlan.operations.map((operation) => (isRecord(operation) ? normalizeOperationObject(operation, request) : operation))
    : [];

  return {
    id: typeof rawPlan.id === "string" ? rawPlan.id : `steward-plan-${Date.now()}`,
    title: typeof rawPlan.title === "string" ? rawPlan.title : "Steward operation plan",
    summary: typeof rawPlan.summary === "string" ? rawPlan.summary : "Preview and apply a Steward operation for the active collection.",
    userRequest: typeof rawPlan.userRequest === "string" ? rawPlan.userRequest : request.request,
    operations,
    warnings: Array.isArray(rawPlan.warnings) ? rawPlan.warnings : [],
    assumptions: Array.isArray(rawPlan.assumptions) ? rawPlan.assumptions : [],
  };
}

function normalizeOperationObject(operation: Record<string, unknown>, request: StewardPlanRequest): Record<string, unknown> {
  const normalizedType = normalizeOperationType(operation.type);
  const normalized = {
    ...operation,
    type: normalizedType,
  };

  if (normalizedType === "split_collection") {
    return {
      ...normalized,
      source: isScope(normalized.source) ? normalized.source : request.scope,
      groupBy: normalizeGroupBy(normalized.groupBy),
      maximumRows: typeof normalized.maximumRows === "number" ? normalized.maximumRows : 75,
      cardmarketMode: typeof normalized.cardmarketMode === "boolean" ? normalized.cardmarketMode : true,
      mode: normalized.mode === "move" ? "move" : "copy",
    };
  }

  if (normalizedType === "create_batches") {
    return {
      ...normalized,
      source: isScope(normalized.source) ? normalized.source : request.scope,
      groupBy: normalizeGroupBy(normalized.groupBy),
      sortBy: Array.isArray(normalized.sortBy) ? normalized.sortBy : [],
      maximumRows: typeof normalized.maximumRows === "number" ? normalized.maximumRows : 75,
      separateFiles: typeof normalized.separateFiles === "boolean" ? normalized.separateFiles : true,
      cardmarketMode: typeof normalized.cardmarketMode === "boolean" ? normalized.cardmarketMode : true,
    };
  }

  return normalized;
}

function normalizeOperationType(type: unknown): unknown {
  if (type === "split" || type === "splitCollection" || type === "split collection") return "split_collection";
  if (type === "batch" || type === "batches" || type === "createBatches" || type === "create batches") return "create_batches";
  if (type === "filter" || type === "view_filter" || type === "set view filter") return "set_view_filter";
  return type;
}

function normalizeGroupBy(groupBy: unknown): unknown[] {
  if (!Array.isArray(groupBy)) {
    return ["setName", "rarity"];
  }

  const normalized = groupBy
    .map((field) => {
      if (field === "set name" || field === "set_name" || field === "setName") return "setName";
      if (field === "set code" || field === "set_code" || field === "setCode") return "setCode";
      return field;
    })
    .filter((field) => field === "setCode" || field === "setName" || field === "rarity" || field === "finish" || field === "language" || field === "condition");

  return normalized.length > 0 ? normalized : ["setName", "rarity"];
}

function isScope(value: unknown): value is StewardPlanRequest["scope"] {
  return value === "all" || value === "filtered" || value === "selected";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStewardResponseType(value: unknown): value is StewardResponse["type"] {
  return value === "plan" || value === "clarification" || value === "unsupported";
}

function isStewardOperationType(value: unknown): boolean {
  return value === "split_collection" || value === "create_batches" || value === "set_view_filter";
}

function isUnsupportedReason(value: unknown): value is "external_data_required" | "operation_not_supported" | "ambiguous_request" | "unsafe_request" {
  return value === "external_data_required" || value === "operation_not_supported" || value === "ambiguous_request" || value === "unsafe_request";
}

function fallbackPlanForPrimarySplitRequest(request: StewardPlanRequest, fallbackReason: string): StewardResponse | null {
  const text = request.request.toLowerCase();
  const asksForSplit =
    /\b(break|split|separate|batch|batches|bulk)\b/.test(text) &&
    /\b(collection|cards|inventory)\b/.test(text);

  if (!asksForSplit) {
    return null;
  }

  const groupBy: BatchGroupingField[] = [];
  if (/set name|setname|expansion/.test(text)) groupBy.push("setName");
  else if (/set code|setcode/.test(text)) groupBy.push("setCode");
  else groupBy.push("setName");
  if (/rarity|rare|mythic|uncommon|common/.test(text)) groupBy.push("rarity");
  if (/foil|finish/.test(text)) groupBy.push("finish");
  if (/language|non-english|english/.test(text)) groupBy.push("language");
  if (/condition|near mint|near_mint|played/.test(text)) groupBy.push("condition");

  const maximumRows = extractMaximumRows(text) ?? 75;
  const plan: StewardPlan = {
    id: `fallback-split-${Date.now()}`,
    title: `Split collection by ${groupBy.join(" and ")}`,
    summary: "Create smaller Cardmarket-oriented collections from the current collection.",
    userRequest: request.request,
    operations: [
      {
        type: "split_collection",
        source: request.scope,
        groupBy,
        maximumRows,
        cardmarketMode: true,
        mode: "copy",
        namingTemplate: "{setName} - {rarity} - batch {index}",
      },
    ],
    warnings: [
      {
        code: "deterministic_fallback",
        message: fallbackReason,
      },
      {
        code: "cardmarket_expansion_review",
        message: "ManaBox set names and set codes may not exactly match Cardmarket expansions.",
      },
    ],
    assumptions: [
      `Use ${maximumRows} rows as the maximum collection size.`,
      "Copy records into new collections so the source collection remains unchanged.",
    ],
  };

  return { type: "plan", plan };
}

function extractMaximumRows(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value)) return null;
  return Math.min(100, Math.max(1, value));
}
