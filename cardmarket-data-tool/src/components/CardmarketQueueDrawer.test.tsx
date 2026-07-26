import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryCard, InventoryCollection } from "../models/inventory";
import { CardmarketQueueDrawer } from "./CardmarketQueueDrawer";

const collection: InventoryCollection = {
  id: "collection-1",
  name: "Main collection",
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T00:00:00.000Z",
};

function card(id: string, targetPrice: number | null): InventoryCard {
  return {
    id,
    collectionId: collection.id,
    sourceRow: id === "ready" ? 2 : 3,
    name: id === "ready" ? "Ready card" : "Blocked card",
    setCode: "DFT",
    setName: "Aetherdrift",
    collectorNumber: id === "ready" ? "1" : "2",
    finish: "normal",
    rarity: "rare",
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
    targetPrice,
    notes: "",
    validationIssues: [],
    unknownColumns: {},
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CardmarketQueueDrawer", () => {
  it("previews blockers and only publishes them after explicit exclusion", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            directory: "C:\\runtime\\jobs\\job-ui",
            job: {
              jobVersion: 1,
              jobId: "job-ui",
              status: "ready",
              createdAt: "2026-07-26T12:00:00.000Z",
              collection: { id: collection.id, name: collection.name },
              settings: {
                scope: "all",
                maximumRows: 75,
                priceSource: "targetPrice",
                excludeBlockedRows: true,
              },
              summary: {
                sourceRecordCount: 2,
                queuedRecordCount: 1,
                excludedRecordCount: 1,
                warningCount: 0,
                batchCount: 1,
              },
              batches: [
                {
                  batchId: "batch-001",
                  sequence: 1,
                  filename: "001__DFT__rare.csv",
                  setCode: "DFT",
                  setName: "Aetherdrift",
                  rarity: "rare",
                  rowCount: 1,
                  totalQuantity: 1,
                  sha256: "a".repeat(64),
                  status: "pending",
                },
              ],
              excludedRows: [
                {
                  cardId: "blocked",
                  sourceRow: 3,
                  cardName: "Blocked card",
                  severity: "error",
                  field: "targetPrice",
                  code: "target_price_required",
                  message: "Target price must be greater than zero before this row can be queued.",
                },
              ],
              warnings: [],
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/cardmarket/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <CardmarketQueueDrawer
        isOpen
        collection={collection}
        cards={[card("ready", 1.5), card("blocked", null)]}
        filteredCards={[card("ready", 1.5), card("blocked", null)]}
        selectedCardIds={[]}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Blocking issues")).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publish queue job" });
    expect(publish).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /exclude blocked rows/i }));
    expect(publish).toBeEnabled();
    await user.click(publish);

    expect(await screen.findByText("Queue published")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/cardmarket/jobs",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
