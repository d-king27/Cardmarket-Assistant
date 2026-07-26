import { z } from "zod";

export const LISTING_PROTOCOL_VERSION = 1 as const;
export const PROTOCOL_VERSION = LISTING_PROTOCOL_VERSION;

export const ListingRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    productId: z.string().trim().min(1).optional(),
    manaboxId: z.string().trim().min(1).optional(),
    scryfallId: z.string().trim().min(1).optional(),
    setCode: z.string().trim().min(1).optional(),
    setName: z.string().trim().min(1).optional(),
    collectorNumber: z.string().trim().min(1).optional(),
    finish: z.string().trim().min(1).optional(),
    rarity: z.string().trim().min(1).optional(),
    language: z.string().trim().min(1).optional(),
    condition: z.string().trim().min(1).optional(),
    price: z.string().trim().min(1).optional(),
    purchasePrice: z.string().trim().min(1).optional(),
    purchasePriceCurrency: z.string().trim().min(1).optional(),
    misprint: z.boolean().optional(),
    altered: z.boolean().optional(),
    addedAt: z.string().trim().min(1).optional(),
    comment: z.string().optional(),
  })
  .strict();

export const ListingBatchMessageSchema = z
  .object({
    protocolVersion: z.literal(LISTING_PROTOCOL_VERSION),
    type: z.literal("listing-batch"),
    batchId: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
    records: z.array(ListingRecordSchema).min(1),
  })
  .strict();

export const CardmarketPageContextSchema = z
  .object({
    url: z.string().url(),
    title: z.string(),
    bulkListingPresent: z.boolean(),
    extensionUiPresent: z.boolean(),
    expansionLabel: z.string().optional(),
    expansionValue: z.string().optional(),
    hitCount: z.number().int().nonnegative().optional(),
    resultsTablePresent: z.boolean(),
    capturedAt: z.string(),
  })
  .strict();

export const FillResultSchema = z
  .object({
    recordId: z.string().trim().min(1),
    status: z.enum(["not-run", "ready", "skipped", "filled", "error"]),
    message: z.string().optional(),
  })
  .strict();

export const ListingBatchResultMessageSchema = z
  .object({
    protocolVersion: z.literal(LISTING_PROTOCOL_VERSION),
    type: z.literal("listing-batch-result"),
    batchId: z.string().trim().min(1),
    mode: z.enum(["dry-run", "fill"]),
    status: z.enum(["not-run", "success", "partial", "error"]),
    pageContext: CardmarketPageContextSchema,
    results: z.array(FillResultSchema),
    errors: z.array(z.string()),
    generatedAt: z.string(),
  })
  .strict();

export type ListingRecord = z.infer<typeof ListingRecordSchema>;
export type ListingBatchMessage = z.infer<typeof ListingBatchMessageSchema>;
export type CardmarketPageContext = z.infer<typeof CardmarketPageContextSchema>;
export type FillResult = z.infer<typeof FillResultSchema>;
export type ListingBatchResultMessage = z.infer<
  typeof ListingBatchResultMessageSchema
>;

export const ListingBatchSchema = ListingBatchMessageSchema;
export type ListingBatch = ListingBatchMessage;

export const BatchResultSchema = ListingBatchResultMessageSchema;
export type BatchResult = ListingBatchResultMessage;
