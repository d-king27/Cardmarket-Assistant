import type { InventoryCard } from "../models/inventory";
import { validateInventoryCard } from "../services/inventoryValidator";
import { planBatches } from "./batchPlanner";
import { filterByPredicate } from "./predicateEvaluator";
import type { FieldChange, OperationPreview, StewardOperation, StewardPlan, StewardRuntimeContext } from "./models";

export interface PlanPreview {
  previews: OperationPreview[];
  destructive: boolean;
  warnings: string[];
}

export function previewPlan(plan: StewardPlan, context: StewardRuntimeContext): PlanPreview {
  const previews = plan.operations.map((operation, index) =>
    previewOperation(operation, context, `${plan.id}-${index + 1}`),
  );

  return {
    previews,
    destructive: previews.some((preview) => preview.destructive),
    warnings: [
      ...plan.warnings.map((warning) => warning.message),
      ...previews.flatMap((preview) => preview.warnings),
    ],
  };
}

export function previewOperation(
  operation: StewardOperation,
  context: StewardRuntimeContext,
  operationId = createId(),
): OperationPreview {
  switch (operation.type) {
    case "split_collection":
    case "create_batches": {
      const sourceCards = sourceFor(operation.source, context);
      const matched = operation.predicate ? filterByPredicate(sourceCards, operation.predicate, context) : sourceCards;
      const maximumRows = operation.type === "split_collection" ? (operation.maximumRows ?? 75) : operation.maximumRows;
      const plannedCollections = planBatches({
        cards: matched,
        groupBy: operation.groupBy,
        sortBy: operation.type === "create_batches" ? operation.sortBy : [{ field: "name", direction: "asc" }],
        maximumRows,
        namingTemplate: operation.namingTemplate,
        cardmarketMode: operation.cardmarketMode,
      });
      return {
        operationId,
        operationType: operation.type,
        matchedRecordCount: matched.length,
        changedRecordCount: operation.type === "split_collection" ? matched.length : 0,
        unchangedRecordCount: Math.max(0, sourceCards.length - matched.length),
        validationErrorCount: 0,
        sampleChanges: [],
        allChanges: [],
        warnings: plannedCollections.flatMap((collection) => collection.warnings).filter(unique),
        destructive: operation.type === "split_collection" && operation.mode === "move",
        plannedCollections,
      };
    }
    case "remove_records": {
      const matched = filterByPredicate(context.cards, operation.predicate, context);
      const changes = matched.map<FieldChange>((card) => ({
        cardId: card.id,
        cardName: card.name,
        field: "row",
        before: "present",
        after: "removed",
      }));
      return basePreview(operationId, operation.type, matched, changes, true);
    }
    case "set_field":
    case "adjust_number":
    case "round_number": {
      const matched = filterByPredicate(context.cards, operation.predicate, context);
      const afterCards = matched.map((card) => applyCardOperation(card, operation));
      const changes = diffCards(matched, afterCards);
      return {
        ...basePreview(operationId, operation.type, matched, changes, false),
        validationErrorCount: afterCards.reduce(
          (count, card) => count + validateInventoryCard(card).filter((issue) => issue.severity === "error").length,
          0,
        ),
      };
    }
    case "set_view_filter":
    case "sort":
    case "prepare_export":
    case "transfer_records":
      return {
        operationId,
        operationType: operation.type,
        matchedRecordCount: 0,
        changedRecordCount: 0,
        unchangedRecordCount: context.cards.length,
        validationErrorCount: 0,
        sampleChanges: [],
        allChanges: [],
        warnings: operation.type === "transfer_records" ? ["Transfer preview is limited in this first Steward pass."] : [],
        destructive: operation.type === "transfer_records" && operation.mode === "move",
        plannedCollections: [],
      };
  }
}

export function applyCardOperation(card: InventoryCard, operation: Extract<StewardOperation, { type: "set_field" | "adjust_number" | "round_number" }>): InventoryCard {
  if (operation.type === "set_field") {
    return { ...card, [operation.field]: operation.value };
  }

  const current = card[operation.field];
  if (typeof current !== "number") return card;

  if (operation.type === "round_number") {
    return { ...card, [operation.field]: roundValue(current, operation.mode, operation.increment) };
  }

  let next = current;
  if (operation.adjustment.mode === "add") next += operation.adjustment.value;
  if (operation.adjustment.mode === "subtract") next -= operation.adjustment.value;
  if (operation.adjustment.mode === "multiply") next *= operation.adjustment.value;
  if (operation.adjustment.mode === "percentage") next *= 1 + operation.adjustment.value / 100;
  if (operation.rounding) next = roundValue(next, operation.rounding.mode, operation.rounding.increment);
  if (operation.minimum !== undefined) next = Math.max(operation.minimum, next);
  if (operation.maximum !== undefined) next = Math.min(operation.maximum, next);
  return { ...card, [operation.field]: Number(next.toFixed(2)) };
}

function basePreview(
  operationId: string,
  operationType: StewardOperation["type"],
  matched: InventoryCard[],
  changes: FieldChange[],
  destructive: boolean,
): OperationPreview {
  return {
    operationId,
    operationType,
    matchedRecordCount: matched.length,
    changedRecordCount: new Set(changes.map((change) => change.cardId)).size,
    unchangedRecordCount: Math.max(0, matched.length - new Set(changes.map((change) => change.cardId)).size),
    validationErrorCount: 0,
    sampleChanges: changes.slice(0, 20),
    allChanges: changes,
    warnings: matched.length === 0 ? ["No records matched this operation."] : [],
    destructive,
    plannedCollections: [],
  };
}

function sourceFor(source: "all" | "filtered" | "selected", context: StewardRuntimeContext): InventoryCard[] {
  if (source === "filtered") return context.filteredCards;
  if (source === "selected") return context.cards.filter((card) => context.selectedCardIds.includes(card.id));
  return context.cards;
}

function diffCards(beforeCards: InventoryCard[], afterCards: InventoryCard[]): FieldChange[] {
  const changes: FieldChange[] = [];
  beforeCards.forEach((before, index) => {
    const after = afterCards[index];
    (["quantity", "condition", "language", "purchasePrice", "purchasePriceCurrency", "targetPrice", "notes"] as const).forEach((field) => {
      if (before[field] !== after[field]) {
        changes.push({ cardId: before.id, cardName: before.name, field, before: before[field], after: after[field] });
      }
    });
  });
  return changes;
}

function roundValue(value: number, mode: "nearest" | "up" | "down", increment: number): number {
  const scaled = value / increment;
  if (mode === "up") return Math.ceil(scaled) * increment;
  if (mode === "down") return Math.floor(scaled) * increment;
  return Math.round(scaled) * increment;
}

function unique<T>(value: T, index: number, values: T[]): boolean {
  return values.indexOf(value) === index;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
