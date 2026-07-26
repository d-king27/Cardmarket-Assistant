import { z } from "zod";

export const QueueItemStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "invalid",
]);

export const ProcessingNoteSchema = z
  .object({
    at: z.string(),
    kind: z.enum(["info", "success", "failure", "skip"]),
    message: z.string(),
  })
  .strict();

export const QueueTargetSchema = z
  .object({
    setTag: z.string().trim().min(1),
    setCode: z.string().trim().min(1).optional(),
    setName: z.string().trim().min(1).optional(),
    rarity: z.string().trim().min(1),
  })
  .strict();

export const QueueValidationSchema = z
  .object({
    rowCount: z.number().int().positive(),
    totalQuantity: z.number().int().positive().optional(),
    headers: z.array(z.string()),
    metadataSource: z.enum(["columns", "filename", "mixed"]),
  })
  .strict();

export const QueueItemSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("inbox"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("queue-job"),
      jobId: z.string().trim().min(1),
      batchId: z.string().trim().min(1),
      manifestPath: z.string().trim().min(1),
    })
    .strict(),
]);

export const QueueItemStagingSchema = z
  .object({
    stagedAt: z.string(),
    state: z.enum(["preview-ready", "no-current-page-matches"]),
    selectedCount: z.number().int().nonnegative(),
    eligibleCount: z.number().int().nonnegative(),
    parsedCount: z.number().int().nonnegative(),
    resultPath: z.string().trim().min(1),
  })
  .strict();

export const ProcessingPlanItemSchema = z
  .object({
    id: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    filePath: z.string().trim().min(1),
    fingerprint: z.string().trim().min(1),
    status: QueueItemStatusSchema,
    attempts: z.number().int().nonnegative(),
    target: QueueTargetSchema.optional(),
    validation: QueueValidationSchema.optional(),
    validationError: z.string().optional(),
    source: QueueItemSourceSchema.optional(),
    staging: QueueItemStagingSchema.optional(),
    notes: z.array(ProcessingNoteSchema),
  })
  .strict();

export const PlanSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
  })
  .strict();

export const ProcessingPlanSchema = z
  .object({
    planVersion: z.literal(1),
    planId: z.string().trim().min(1),
    inputDirectory: z.string().trim().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    summary: PlanSummarySchema,
    items: z.array(ProcessingPlanItemSchema),
  })
  .strict();

export type QueueItemStatus = z.infer<typeof QueueItemStatusSchema>;
export type ProcessingNote = z.infer<typeof ProcessingNoteSchema>;
export type QueueTarget = z.infer<typeof QueueTargetSchema>;
export type QueueValidation = z.infer<typeof QueueValidationSchema>;
export type QueueItemSource = z.infer<typeof QueueItemSourceSchema>;
export type QueueItemStaging = z.infer<typeof QueueItemStagingSchema>;
export type ProcessingPlanItem = z.infer<typeof ProcessingPlanItemSchema>;
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
export type ProcessingPlan = z.infer<typeof ProcessingPlanSchema>;
