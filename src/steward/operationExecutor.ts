import type { InventoryCard, InventoryCollection } from "../models/inventory";
import { applyValidationAndDuplicateWarnings } from "../services/duplicateDetector";
import type { StewardAuditEntry, StewardChangeSet, StewardPlan, StewardRuntimeContext } from "./models";
import { previewPlan } from "./operationPreview";

export function executeApprovedPlan({
  plan,
  context,
  promptVersion,
  model,
}: {
  plan: StewardPlan;
  context: StewardRuntimeContext;
  promptVersion: string;
  model: string;
}): { cards: InventoryCard[]; collections: InventoryCollection[]; auditEntry: StewardAuditEntry } {
  const preview = previewPlan(plan, context);
  const createdCollections: InventoryCollection[] = [];
  let nextCards = [...context.cards];
  const now = new Date().toISOString();

  preview.previews.forEach((operationPreview) => {
    if (operationPreview.operationType === "split_collection") {
      operationPreview.plannedCollections.forEach((planned) => {
        const collection: InventoryCollection = {
          id: createId(),
          name: makeUniqueName(planned.name, [...context.existingCollections, ...createdCollections]),
          createdAt: now,
          updatedAt: now,
        };
        createdCollections.push(collection);
        const sourceCards = context.cards.filter((card) => planned.sourceCardIds.includes(card.id));
        nextCards.push(
          ...sourceCards.map((card) => ({
            ...card,
            id: createId(),
            collectionId: collection.id,
            updatedAt: now,
          })),
        );
      });
    }
  });

  nextCards = applyValidationAndDuplicateWarnings(nextCards);
  const changeSet: StewardChangeSet = {
    beforeCards: context.cards,
    afterCards: nextCards,
    createdCollections,
    removedCardIds: [],
  };

  return {
    cards: nextCards,
    collections: [...context.existingCollections, ...createdCollections],
    auditEntry: {
      id: createId(),
      collectionId: context.collection.id,
      createdAt: now,
      userRequest: plan.userRequest,
      promptVersion,
      model,
      plan,
      changeSet,
      status: "applied",
    },
  };
}

function makeUniqueName(baseName: string, collections: InventoryCollection[]): string {
  const existing = new Set(collections.map((collection) => collection.name.toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;

  const cardmarketName = parseCardmarketCollectionName(baseName);
  if (cardmarketName) {
    let sequence = cardmarketName.sequence + 1;
    let candidate = formatCardmarketCollectionName(sequence, cardmarketName.setCode, cardmarketName.rarity);
    while (existing.has(candidate.toLowerCase())) {
      sequence += 1;
      candidate = formatCardmarketCollectionName(sequence, cardmarketName.setCode, cardmarketName.rarity);
    }
    return candidate;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (existing.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
}

function parseCardmarketCollectionName(value: string): { sequence: number; setCode: string; rarity: string } | null {
  const match = value.match(/^(\d{3})__([A-Z0-9]+)__([a-z0-9_-]+)$/i);
  if (!match) return null;
  return {
    sequence: Number(match[1]),
    setCode: match[2].toUpperCase(),
    rarity: match[3].toLowerCase(),
  };
}

function formatCardmarketCollectionName(sequence: number, setCode: string, rarity: string): string {
  return `${String(sequence).padStart(3, "0")}__${setCode}__${rarity}`;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `steward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
