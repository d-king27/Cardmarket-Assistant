import Papa from "papaparse";
import type { InventoryCard } from "../models/inventory";
import { manaboxHeaders, parseManaBoxCsv } from "./csvParser";

const exportHeaders = [...manaboxHeaders, "Target price", "Notes"];

export function exportInventoryToCsv(cards: InventoryCard[]): string {
  return Papa.unparse(
    {
      fields: exportHeaders,
      data: cards.map(cardToRow),
    },
    {
      quotes: true,
      newline: "\r\n",
    },
  );
}

export function makeExportFilename(date = new Date()): string {
  const isoDate = date.toISOString().slice(0, 10);
  return `manabox-inventory-${isoDate}.csv`;
}

export function validateRoundTrip(csv: string) {
  return parseManaBoxCsv(csv);
}

function cardToRow(card: InventoryCard): Record<string, string> {
  return {
    Name: card.name,
    "Set code": card.setCode,
    "Set name": card.setName,
    "Collector number": card.collectorNumber,
    Foil: card.finish,
    Rarity: card.rarity,
    Quantity: String(card.quantity),
    "ManaBox ID": card.manaBoxId ?? "",
    "Scryfall ID": card.scryfallId ?? "",
    "Purchase price": card.purchasePrice === null ? "" : String(card.purchasePrice),
    Misprint: String(card.misprint),
    Altered: String(card.altered),
    Condition: card.condition,
    Language: card.language,
    "Purchase price currency": card.purchasePriceCurrency ?? "",
    Added: card.addedAt ?? "",
    "Target price": card.targetPrice === null ? "" : String(card.targetPrice),
    Notes: card.notes,
  };
}
