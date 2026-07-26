import { z } from "zod";

export const CARDMARKET_QUEUE_VERSION = 1 as const;
export const DEFAULT_MAXIMUM_ROWS = 75;

export const queueScopeSchema = z.enum(["all", "filtered", "selected"]);
export type QueueScope = z.infer<typeof queueScopeSchema>;

export const queueSettingsSchema = z
  .object({
    scope: queueScopeSchema,
    maximumRows: z.number().int().min(1).max(100),
    priceSource: z.literal("targetPrice"),
    excludeBlockedRows: z.boolean(),
  })
  .strict();
export type QueueSettings = z.infer<typeof queueSettingsSchema>;

export const queueValidationIssueSchema = z
  .object({
    field: z.string(),
    severity: z.enum(["warning", "error"]),
    code: z.string(),
    message: z.string(),
  })
  .strict();
export type QueueValidationIssue = z.infer<typeof queueValidationIssueSchema>;

export const queueSourceCardSchema = z
  .object({
    id: z.string().trim().min(1),
    sourceRow: z.number().int().positive(),
    name: z.string(),
    setCode: z.string(),
    setName: z.string(),
    collectorNumber: z.string(),
    finish: z.string(),
    rarity: z.string(),
    quantity: z.number(),
    manaBoxId: z.string().nullable(),
    scryfallId: z.string().nullable(),
    purchasePrice: z.number().nullable(),
    purchasePriceCurrency: z.string().nullable(),
    misprint: z.boolean(),
    altered: z.boolean(),
    condition: z.string(),
    language: z.string(),
    addedAt: z.string().nullable(),
    targetPrice: z.number().nullable(),
    notes: z.string(),
    validationIssues: z.array(queueValidationIssueSchema),
  })
  .strict();
export type QueueSourceCard = z.infer<typeof queueSourceCardSchema>;

export const queuePublishRequestSchema = z
  .object({
    collectionId: z.string().trim().min(1),
    collectionName: z.string().trim().min(1),
    settings: queueSettingsSchema,
    cards: z.array(queueSourceCardSchema).min(1).max(50_000),
  })
  .strict();
export type QueuePublishRequest = z.infer<typeof queuePublishRequestSchema>;

export const queueIssueSchema = z
  .object({
    cardId: z.string(),
    sourceRow: z.number().int().positive(),
    cardName: z.string(),
    severity: z.enum(["warning", "error"]),
    field: z.string(),
    code: z.string(),
    message: z.string(),
  })
  .strict();
export type QueueIssue = z.infer<typeof queueIssueSchema>;

export const plannedQueueBatchSchema = z
  .object({
    batchId: z.string(),
    sequence: z.number().int().positive(),
    filename: z.string(),
    setCode: z.string(),
    setName: z.string(),
    rarity: z.string(),
    rowCount: z.number().int().positive(),
    totalQuantity: z.number().int().positive(),
    sourceCardIds: z.array(z.string()).min(1),
  })
  .strict();
export type PlannedQueueBatch = z.infer<typeof plannedQueueBatchSchema>;

export const queuePreviewSchema = z
  .object({
    settings: queueSettingsSchema,
    sourceRecordCount: z.number().int().nonnegative(),
    readyRecordCount: z.number().int().nonnegative(),
    blockedRecordCount: z.number().int().nonnegative(),
    excludedRecordCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    batches: z.array(plannedQueueBatchSchema),
    blockers: z.array(queueIssueSchema),
    warnings: z.array(queueIssueSchema),
  })
  .strict();
export type QueuePreview = z.infer<typeof queuePreviewSchema>;

export const queueBatchStatusSchema = z.enum([
  "pending",
  "processing",
  "succeeded",
  "partial",
  "failed",
]);
export type QueueBatchStatus = z.infer<typeof queueBatchStatusSchema>;

export const queueJobStatusSchema = z.enum([
  "ready",
  "processing",
  "completed",
  "partial",
  "failed",
]);
export type QueueJobStatus = z.infer<typeof queueJobStatusSchema>;

export const queueManifestBatchSchema = plannedQueueBatchSchema
  .omit({ sourceCardIds: true })
  .extend({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: queueBatchStatusSchema,
  })
  .strict();
export type QueueManifestBatch = z.infer<typeof queueManifestBatchSchema>;

export const queueJobManifestSchema = z
  .object({
    jobVersion: z.literal(CARDMARKET_QUEUE_VERSION),
    jobId: z.string().regex(/^job-[a-zA-Z0-9-]+$/),
    status: queueJobStatusSchema,
    createdAt: z.string(),
    collection: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .strict(),
    settings: queueSettingsSchema,
    summary: z
      .object({
        sourceRecordCount: z.number().int().nonnegative(),
        queuedRecordCount: z.number().int().nonnegative(),
        excludedRecordCount: z.number().int().nonnegative(),
        warningCount: z.number().int().nonnegative(),
        batchCount: z.number().int().nonnegative(),
      })
      .strict(),
    batches: z.array(queueManifestBatchSchema),
    excludedRows: z.array(queueIssueSchema),
    warnings: z.array(queueIssueSchema),
  })
  .strict();
export type QueueJobManifest = z.infer<typeof queueJobManifestSchema>;

export const QueueJobSchema = queueJobManifestSchema;
export type QueueJob = QueueJobManifest;
