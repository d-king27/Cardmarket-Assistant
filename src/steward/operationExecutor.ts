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
  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (existing.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `steward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
