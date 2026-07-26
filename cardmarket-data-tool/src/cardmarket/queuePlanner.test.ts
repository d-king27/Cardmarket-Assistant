import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import type {
  QueuePublishRequest,
  QueueSourceCard,
} from "./queueModels";
import { serializeCardmarketQueueCsv } from "./queueCsv";
import { planCardmarketQueue } from "./queuePlanner";

function card(overrides: Partial<QueueSourceCard> = {}): QueueSourceCard {
  return {
    id: "card-1",
    sourceRow: 2,
    name: "Lightning Helix",
    setCode: "RVR",
    setName: "Ravnica Remastered",
    collectorNumber: "190",
    finish: "normal",
    rarity: "uncommon",
    quantity: 1,
    manaBoxId: null,
    scryfallId: null,
    purchasePrice: 0.5,
    purchasePriceCurrency: "GBP",
    misprint: false,
    altered: false,
    condition: "near_mint",
    language: "en",
    addedAt: null,
    targetPrice: 1.25,
    notes: "",
    validationIssues: [],
    ...overrides,
  };
}

function request(cards: QueueSourceCard[], maximumRows = 75, excludeBlockedRows = false): QueuePublishRequest {
  return {
    collectionId: "collection-1",
    collectionName: "Main collection",
    settings: {
      scope: "all",
      maximumRows,
      priceSource: "targetPrice",
      excludeBlockedRows,
    },
    cards,
  };
}

describe("planCardmarketQueue", () => {
  it("groups deterministically by set and rarity and respects the row limit", () => {
    const cards = [
      card({ id: "3", name: "Third", collectorNumber: "3" }),
      card({ id: "1", name: "First", collectorNumber: "1" }),
      card({ id: "2", name: "Second", collectorNumber: "2" }),
      card({ id: "4", name: "Rare card", rarity: "rare", collectorNumber: "4" }),
    ];

    const first = planCardmarketQueue(request(cards, 2));
    const second = planCardmarketQueue(request([...cards].reverse(), 2));

    expect(first.preview.batches.map((batch) => batch.filename)).toEqual([
      "001__RVR__rare.csv",
      "002__RVR__uncommon.csv",
      "003__RVR__uncommon.csv",
    ]);
    expect(first.preview.batches).toEqual(second.preview.batches);
    expect(first.preview.batches.every((batch) => batch.rowCount <= 2)).toBe(true);
  });

  it("keeps normal and foil records together but blocks etched records", () => {
    const plan = planCardmarketQueue(
      request([
        card({ id: "normal", finish: "normal" }),
        card({ id: "foil", finish: "foil", collectorNumber: "191" }),
        card({ id: "etched", finish: "etched", collectorNumber: "192" }),
      ]),
    );

    expect(plan.preview.batches).toHaveLength(1);
    expect(plan.preview.readyRecordCount).toBe(2);
    expect(plan.preview.blockedRecordCount).toBe(1);
    expect(plan.preview.blockers.some((issue) => issue.code === "etched_unsupported")).toBe(true);
  });

  it("blocks missing target prices without substituting purchase price", () => {
    const plan = planCardmarketQueue(
      request([card({ targetPrice: null, purchasePrice: 42 })]),
    );

    expect(plan.preview.readyRecordCount).toBe(0);
    expect(plan.preview.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target_price_required",
          field: "targetPrice",
        }),
      ]),
    );
  });

  it("serializes a scanner-compatible single-set and single-rarity CSV", () => {
    const plan = planCardmarketQueue(
      request([
        card({ id: "a" }),
        card({ id: "b", name: "Zahur", collectorNumber: "7", finish: "foil" }),
      ]),
    );
    const csv = serializeCardmarketQueueCsv(plan.batches[0].records);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data).toHaveLength(2);
    expect(new Set(parsed.data.map((row) => row["Set code"]))).toEqual(new Set(["RVR"]));
    expect(new Set(parsed.data.map((row) => row.Rarity))).toEqual(new Set(["uncommon"]));
    expect(parsed.data.map((row) => row.Price)).toEqual(["1.25", "1.25"]);
  });
});
