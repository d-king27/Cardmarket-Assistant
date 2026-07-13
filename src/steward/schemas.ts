import { z } from "zod";

export const predicateFieldSchema = z.enum([
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
]);

export const predicateOperatorSchema = z.enum([
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
]);

const predicateValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
]);

export const inventoryPredicateSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("condition"),
      field: predicateFieldSchema,
      operator: predicateOperatorSchema,
      value: predicateValueSchema.optional(),
    }),
    z.object({ type: z.literal("and"), predicates: z.array(inventoryPredicateSchema).min(1).max(12) }),
    z.object({ type: z.literal("or"), predicates: z.array(inventoryPredicateSchema).min(1).max(12) }),
    z.object({ type: z.literal("not"), predicate: inventoryPredicateSchema }),
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("selected") }),
    z.object({ type: z.literal("currently_filtered") }),
  ]),
);

export const sortableInventoryFieldSchema = z.enum([
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
]);

export const batchGroupingFieldSchema = z.enum([
  "setCode",
  "setName",
  "rarity",
  "finish",
  "language",
  "condition",
]);

const sortRuleSchema = z.object({
  field: sortableInventoryFieldSchema,
  direction: z.enum(["asc", "desc"]),
});

export const stewardOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_view_filter"), predicate: inventoryPredicateSchema }),
  z.object({
    type: z.literal("sort"),
    fields: z.array(sortRuleSchema).min(1).max(6),
    target: z.enum(["view", "export"]),
  }),
  z.object({
    type: z.literal("set_field"),
    predicate: inventoryPredicateSchema,
    field: z.enum(["quantity", "condition", "language", "purchasePrice", "purchasePriceCurrency", "targetPrice", "notes"]),
    value: z.union([z.string(), z.number(), z.null()]),
  }),
  z.object({
    type: z.literal("adjust_number"),
    predicate: inventoryPredicateSchema,
    field: z.enum(["quantity", "purchasePrice", "targetPrice"]),
    adjustment: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("add"), value: z.number() }),
      z.object({ mode: z.literal("subtract"), value: z.number() }),
      z.object({ mode: z.literal("multiply"), value: z.number() }),
      z.object({ mode: z.literal("percentage"), value: z.number() }),
    ]),
    rounding: z.object({ mode: z.enum(["nearest", "up", "down"]), increment: z.number().positive() }).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
  }),
  z.object({
    type: z.literal("round_number"),
    predicate: inventoryPredicateSchema,
    field: z.enum(["purchasePrice", "targetPrice"]),
    mode: z.enum(["nearest", "up", "down"]),
    increment: z.number().positive(),
  }),
  z.object({ type: z.literal("remove_records"), predicate: inventoryPredicateSchema }),
  z.object({
    type: z.literal("transfer_records"),
    predicate: inventoryPredicateSchema,
    destinationCollectionName: z.string().min(1).max(100),
    mode: z.enum(["copy", "move"]),
  }),
  z.object({
    type: z.literal("create_batches"),
    source: z.enum(["all", "filtered", "selected"]),
    predicate: inventoryPredicateSchema.optional(),
    groupBy: z.array(batchGroupingFieldSchema).min(1).max(6),
    sortBy: z.array(sortRuleSchema).max(6),
    maximumRows: z.number().int().min(1).max(100),
    separateFiles: z.boolean(),
    cardmarketMode: z.boolean(),
    namingTemplate: z.string().max(140).optional(),
  }),
  z.object({
    type: z.literal("split_collection"),
    source: z.enum(["all", "filtered", "selected"]),
    predicate: inventoryPredicateSchema.optional(),
    groupBy: z.array(batchGroupingFieldSchema).min(1).max(6),
    maximumRows: z.number().int().min(1).max(100).optional(),
    namingTemplate: z.string().max(140).optional(),
    cardmarketMode: z.boolean(),
    mode: z.enum(["copy", "move"]).default("copy"),
  }),
  z.object({
    type: z.literal("prepare_export"),
    source: z.enum(["all", "filtered", "selected", "batch"]),
    excludeInvalidRows: z.boolean(),
    sortBy: z.array(sortRuleSchema).max(6),
  }),
]);

export const stewardPlanSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  userRequest: z.string().min(1).max(2000),
  operations: z.array(stewardOperationSchema).min(1).max(8),
  warnings: z.array(z.object({ code: z.string().min(1).max(80), message: z.string().min(1).max(400) })).max(12),
  assumptions: z.array(z.string().min(1).max(300)).max(12),
});

export const stewardResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan"), plan: stewardPlanSchema }),
  z.object({
    type: z.literal("clarification"),
    question: z.string().min(1).max(400),
    options: z.array(z.string().min(1).max(120)).max(6).optional(),
  }),
  z.object({
    type: z.literal("unsupported"),
    message: z.string().min(1).max(400),
    reason: z.enum(["external_data_required", "operation_not_supported", "ambiguous_request", "unsafe_request"]),
  }),
]);

export const stewardPlanRequestSchema = z.object({
  request: z.string().trim().min(1).max(2000),
  scope: z.enum(["all", "filtered", "selected"]),
  context: z.object({
    collectionId: z.string().min(1).max(120),
    collectionName: z.string().min(1).max(120),
    recordCount: z.number().int().min(0).max(200000),
    totalQuantity: z.number().min(0).max(1000000),
    selectedCount: z.number().int().min(0).max(200000),
    currentFilters: z.unknown(),
    facets: z.object({
      sets: z.array(z.object({ code: z.string().max(40), name: z.string().max(160), recordCount: z.number().int().min(0) })).max(500),
      rarities: z.array(z.string().max(60)).max(50),
      conditions: z.array(z.string().max(60)).max(50),
      languages: z.array(z.string().max(60)).max(80),
      finishes: z.array(z.string().max(60)).max(30),
      currencies: z.array(z.string().max(10)).max(30),
    }),
    statistics: z.object({
      purchasePrice: z.object({ minimum: z.number(), maximum: z.number(), average: z.number(), populatedCount: z.number().int() }).nullable(),
      targetPrice: z.object({ minimum: z.number(), maximum: z.number(), average: z.number(), populatedCount: z.number().int() }).nullable(),
      errorCount: z.number().int().min(0),
      warningCount: z.number().int().min(0),
    }),
  }),
});
