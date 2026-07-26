import type { InventoryCard, InventoryCollection, InventoryFilters } from "../models/inventory";
import type { CollectionSummaryContext, NumericSummary } from "./models";

export function buildCollectionSummaryContext({
  collection,
  cards,
  selectedCardIds,
  filters,
}: {
  collection: InventoryCollection;
  cards: InventoryCard[];
  selectedCardIds: string[];
  filters: InventoryFilters;
}): CollectionSummaryContext {
  const setMap = new Map<string, { code: string; name: string; recordCount: number }>();

  cards.forEach((card) => {
    const key = card.setCode || card.setName || "unknown";
    const current = setMap.get(key) ?? { code: card.setCode, name: card.setName, recordCount: 0 };
    current.recordCount += 1;
    setMap.set(key, current);
  });

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    recordCount: cards.length,
    totalQuantity: cards.reduce((total, card) => total + Math.max(0, card.quantity), 0),
    selectedCount: selectedCardIds.length,
    currentFilters: filters,
    facets: {
      sets: [...setMap.values()].sort((left, right) => left.code.localeCompare(right.code)),
      rarities: unique(cards.map((card) => card.rarity)),
      conditions: unique(cards.map((card) => card.condition)),
      languages: unique(cards.map((card) => card.language)),
      finishes: unique(cards.map((card) => card.finish)),
      currencies: unique(cards.map((card) => card.purchasePriceCurrency ?? "")),
    },
    statistics: {
      purchasePrice: numericSummary(cards.map((card) => card.purchasePrice)),
      targetPrice: numericSummary(cards.map((card) => card.targetPrice)),
      errorCount: cards.filter((card) => card.validationIssues.some((issue) => issue.severity === "error")).length,
      warningCount: cards.filter((card) => card.validationIssues.some((issue) => issue.severity === "warning")).length,
    },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function numericSummary(values: Array<number | null>): NumericSummary | null {
  const populated = values.filter((value): value is number => typeof value === "number");
  if (populated.length === 0) return null;
  return {
    minimum: Math.min(...populated),
    maximum: Math.max(...populated),
    average: populated.reduce((total, value) => total + value, 0) / populated.length,
    populatedCount: populated.length,
  };
}
