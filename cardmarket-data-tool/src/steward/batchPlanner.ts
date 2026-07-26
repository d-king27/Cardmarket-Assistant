import type { InventoryCard } from "../models/inventory";
import type { BatchGroupingField, PlannedCollection, SortableInventoryField } from "./models";

export interface BatchPlanInput {
  cards: InventoryCard[];
  groupBy: BatchGroupingField[];
  sortBy: Array<{ field: SortableInventoryField; direction: "asc" | "desc" }>;
  maximumRows: number;
  namingTemplate?: string;
  cardmarketMode: boolean;
}

export function planBatches(input: BatchPlanInput): PlannedCollection[] {
  const grouped = new Map<string, InventoryCard[]>();
  input.cards.forEach((card) => {
    const key = input.groupBy.map((field) => normalizeGroupValue(card[field])).join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  });

  const planned: PlannedCollection[] = [];
  [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, groupCards]) => {
      const groupValues = Object.fromEntries(
        input.groupBy.map((field, index) => [field, key.split("|")[index] || "unknown"]),
      );
      groupValues.setCode = groupValues.setCode || normalizeGroupValue(groupCards[0]?.setCode);
      groupValues.rarity = groupValues.rarity || normalizeGroupValue(groupCards[0]?.rarity);
      const sortedCards = sortCards(groupCards, input.sortBy);
      const chunks = chunk(sortedCards, input.maximumRows);

      chunks.forEach((cards, index) => {
        const batchNumber = planned.length + 1;
        const name = input.cardmarketMode
          ? makeCardmarketBatchName(groupValues, batchNumber)
          : makeBatchName(groupValues, input.namingTemplate, index + 1);
        planned.push({
          id: stableBatchId(name, batchNumber),
          name,
          recordCount: cards.length,
          totalQuantity: cards.reduce((total, card) => total + Math.max(0, card.quantity), 0),
          groupValues,
          sourceCardIds: cards.map((card) => card.id),
          filename: input.cardmarketMode ? `${name}.csv` : `${slug(name)}.csv`,
          warnings: input.cardmarketMode
            ? [
                "ManaBox set names and set codes may not exactly match Cardmarket expansions.",
                "Cardmarket Extras groupings may require manual review.",
              ]
            : [],
        });
      });
    });

  return planned;
}

export function sortCards(
  cards: InventoryCard[],
  sortBy: Array<{ field: SortableInventoryField; direction: "asc" | "desc" }>,
): InventoryCard[] {
  return [...cards].sort((left, right) => {
    for (const rule of sortBy) {
      const leftValue = left[rule.field] ?? "";
      const rightValue = right[rule.field] ?? "";
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return left.name.localeCompare(right.name);
  });
}

function normalizeGroupValue(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "unknown";
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function makeBatchName(groupValues: Record<string, string>, template: string | undefined, batchIndex: number): string {
  const fallback = `${Object.values(groupValues).join(" - ")} - batch ${String(batchIndex).padStart(2, "0")}`;
  if (!template) return fallback;
  return template.replace(/\{(\w+)\}/g, (_, field: string) => {
    if (field === "index") return String(batchIndex).padStart(2, "0");
    return groupValues[field] ?? "";
  });
}

function makeCardmarketBatchName(groupValues: Record<string, string>, batchNumber: number): string {
  const sequence = String(batchNumber).padStart(3, "0");
  const setCode = sanitizeSetCode(groupValues.setCode);
  const rarity = sanitizeFilenamePart(groupValues.rarity).toLowerCase();
  return `${sequence}__${setCode}__${rarity}`;
}

function stableBatchId(name: string, index: number): string {
  return `${slug(name)}-${index}`;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "batch";
}

function sanitizeSetCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "") || "UNKNOWN";
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}
