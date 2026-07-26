import { describe, expect, it } from "vitest";
import type { InventoryCard, InventoryCollection, InventoryFilters } from "../models/inventory";
import { evaluatePredicate } from "./predicateEvaluator";
import type { StewardRuntimeContext } from "./models";

const card: InventoryCard = {
  id: "card-1",
  collectionId: "collection-1",
  sourceRow: 2,
  name: "Alpha Rare",
  setCode: "FDN",
  setName: "Foundations",
  collectorNumber: "12a",
  finish: "normal",
  rarity: "rare",
  quantity: 2,
  manaBoxId: null,
  scryfallId: null,
  purchasePrice: 1.5,
  purchasePriceCurrency: "GBP",
  misprint: false,
  altered: false,
  condition: "near_mint",
  language: "en",
  addedAt: null,
  targetPrice: 2,
  notes: "",
  validationIssues: [],
  unknownColumns: {},
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const context: StewardRuntimeContext = {
  collection: { id: "collection-1", name: "Main collection", createdAt: "", updatedAt: "" } satisfies InventoryCollection,
  cards: [card],
  filteredCards: [card],
  selectedCardIds: ["card-1"],
  filters: {
    setCode: "",
    rarity: "",
    condition: "",
    language: "",
    finish: "",
    validationStatus: "",
  } satisfies InventoryFilters,
  existingCollections: [],
};

describe("evaluatePredicate", () => {
  it("handles equality predicates", () => {
    expect(evaluatePredicate({ type: "condition", field: "rarity", operator: "equals", value: "rare" }, card, context)).toBe(true);
  });

  it("handles numeric comparisons", () => {
    expect(evaluatePredicate({ type: "condition", field: "targetPrice", operator: "greater_than", value: 1.75 }, card, context)).toBe(true);
  });

  it("handles nested AND, OR and NOT predicates", () => {
    expect(
      evaluatePredicate(
        {
          type: "and",
          predicates: [
            { type: "condition", field: "setName", operator: "contains", value: "found" },
            {
              type: "or",
              predicates: [
                { type: "condition", field: "language", operator: "equals", value: "fr" },
                { type: "not", predicate: { type: "condition", field: "finish", operator: "equals", value: "foil" } },
              ],
            },
          ],
        },
        card,
        context,
      ),
    ).toBe(true);
  });

  it("handles selected and currently filtered predicates", () => {
    expect(evaluatePredicate({ type: "selected" }, card, context)).toBe(true);
    expect(evaluatePredicate({ type: "currently_filtered" }, card, context)).toBe(true);
  });

  it("rejects invalid operators for field type", () => {
    expect(() =>
      evaluatePredicate({ type: "condition", field: "quantity", operator: "contains", value: "2" }, card, context),
    ).toThrow(/not valid/);
  });
});
