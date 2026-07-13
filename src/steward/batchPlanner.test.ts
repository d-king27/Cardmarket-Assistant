import { describe, expect, it } from "vitest";
import type { InventoryCard } from "../models/inventory";
import { planBatches } from "./batchPlanner";
import { previewPlan } from "./operationPreview";
import type { StewardPlan, StewardRuntimeContext } from "./models";

function card(id: string, setName: string, rarity: string): InventoryCard {
  return {
    id,
    collectionId: "c1",
    sourceRow: 2,
    name: `Card ${id}`,
    setCode: setName.slice(0, 3).toUpperCase(),
    setName,
    collectorNumber: id,
    finish: "normal",
    rarity,
    quantity: 1,
    manaBoxId: null,
    scryfallId: null,
    purchasePrice: null,
    purchasePriceCurrency: null,
    misprint: false,
    altered: false,
    condition: "near_mint",
    language: "en",
    addedAt: null,
    targetPrice: null,
    notes: "",
    validationIssues: [],
    unknownColumns: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const cards = [
  card("1", "Foundations", "rare"),
  card("2", "Foundations", "rare"),
  card("3", "Foundations", "uncommon"),
  card("4", "Tarkir", "rare"),
];

describe("planBatches", () => {
  it("groups by set and rarity and respects maximum batch size", () => {
    const batches = planBatches({
      cards,
      groupBy: ["setName", "rarity"],
      sortBy: [{ field: "name", direction: "asc" }],
      maximumRows: 1,
      cardmarketMode: true,
    });

    expect(batches).toHaveLength(4);
    expect(batches[0].filename).toMatch(/batch-01\\.csv$/);
    expect(batches.every((batch) => batch.recordCount <= 1)).toBe(true);
    expect(batches.some((batch) => batch.warnings.some((warning) => warning.includes("Cardmarket")))).toBe(true);
  });
});

describe("split preview", () => {
  it("previews collections to create for the primary Steward use case", () => {
    const context: StewardRuntimeContext = {
      collection: { id: "c1", name: "Main collection", createdAt: "", updatedAt: "" },
      cards,
      filteredCards: cards,
      selectedCardIds: [],
      filters: { setCode: "", rarity: "", condition: "", language: "", finish: "", validationStatus: "" },
      existingCollections: [],
    };
    const plan: StewardPlan = {
      id: "plan-1",
      title: "Split by set and rarity",
      summary: "Create Cardmarket-sized collections grouped by set name and rarity.",
      userRequest: "Break this collection down by set name and rarity",
      warnings: [],
      assumptions: [],
      operations: [
        {
          type: "split_collection",
          source: "all",
          groupBy: ["setName", "rarity"],
          maximumRows: 75,
          cardmarketMode: true,
          mode: "copy",
        },
      ],
    };

    const preview = previewPlan(plan, context);

    expect(preview.previews[0].plannedCollections).toHaveLength(3);
    expect(preview.previews[0].changedRecordCount).toBe(4);
  });
});
