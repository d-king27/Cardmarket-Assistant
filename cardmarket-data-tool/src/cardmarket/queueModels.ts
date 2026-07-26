import {
  queuePublishRequestSchema,
  queueSourceCardSchema,
} from "@cardmarket-assistant/contracts";
import type {
  PlannedQueueBatch,
  QueuePreview,
  QueuePublishRequest,
  QueueSettings,
  QueueSourceCard,
} from "@cardmarket-assistant/contracts";
import type { InventoryCard, InventoryCollection } from "../models/inventory";

export {
  CARDMARKET_QUEUE_VERSION,
  DEFAULT_MAXIMUM_ROWS,
  plannedQueueBatchSchema,
  queueBatchStatusSchema,
  queueIssueSchema,
  queueJobManifestSchema,
  queueJobStatusSchema,
  queueManifestBatchSchema,
  queuePreviewSchema,
  queuePublishRequestSchema,
  queueScopeSchema,
  queueSettingsSchema,
  queueSourceCardSchema,
  queueValidationIssueSchema,
} from "@cardmarket-assistant/contracts";
export type {
  PlannedQueueBatch,
  QueueBatchStatus,
  QueueIssue,
  QueueJobManifest,
  QueueJobStatus,
  QueueManifestBatch,
  QueuePreview,
  QueuePublishRequest,
  QueueScope,
  QueueSettings,
  QueueSourceCard,
  QueueValidationIssue,
} from "@cardmarket-assistant/contracts";

export interface PreparedQueueRecord extends QueueSourceCard {
  setCode: string;
  setName: string;
  finish: "normal" | "foil";
  rarity: string;
  listingPrice: number;
}

export interface PreparedQueueBatch extends PlannedQueueBatch {
  records: PreparedQueueRecord[];
}

export interface QueuePlan {
  preview: QueuePreview;
  batches: PreparedQueueBatch[];
}

export function inventoryCardToQueueSource(card: InventoryCard): QueueSourceCard {
  return queueSourceCardSchema.parse({
    id: card.id,
    sourceRow: card.sourceRow,
    name: card.name,
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    finish: card.finish,
    rarity: card.rarity,
    quantity: card.quantity,
    manaBoxId: card.manaBoxId,
    scryfallId: card.scryfallId,
    purchasePrice: card.purchasePrice,
    purchasePriceCurrency: card.purchasePriceCurrency,
    misprint: card.misprint,
    altered: card.altered,
    condition: card.condition,
    language: card.language,
    addedAt: card.addedAt,
    targetPrice: card.targetPrice,
    notes: card.notes,
    validationIssues: card.validationIssues,
  });
}

export function buildQueuePublishRequest(input: {
  collection: InventoryCollection;
  cards: InventoryCard[];
  settings: QueueSettings;
}): QueuePublishRequest {
  return queuePublishRequestSchema.parse({
    collectionId: input.collection.id,
    collectionName: input.collection.name,
    settings: input.settings,
    cards: input.cards.map(inventoryCardToQueueSource),
  });
}
