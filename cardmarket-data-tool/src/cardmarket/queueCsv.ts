import Papa from "papaparse";
import type { PreparedQueueRecord } from "./queueModels";

export const cardmarketQueueHeaders = [
  "Name",
  "Set code",
  "Set name",
  "Collector number",
  "Foil",
  "Rarity",
  "Quantity",
  "ManaBox ID",
  "Scryfall ID",
  "Purchase price",
  "Misprint",
  "Altered",
  "Condition",
  "Language",
  "Purchase price currency",
  "Added",
  "Price",
  "Target price",
  "Notes",
] as const;

export function serializeCardmarketQueueCsv(records: PreparedQueueRecord[]): string {
  return Papa.unparse(
    {
      fields: [...cardmarketQueueHeaders],
      data: records.map((record) => ({
        Name: record.name,
        "Set code": record.setCode,
        "Set name": record.setName,
        "Collector number": record.collectorNumber,
        Foil: record.finish,
        Rarity: record.rarity,
        Quantity: String(record.quantity),
        "ManaBox ID": record.manaBoxId ?? "",
        "Scryfall ID": record.scryfallId ?? "",
        "Purchase price": record.purchasePrice === null ? "" : String(record.purchasePrice),
        Misprint: String(record.misprint),
        Altered: String(record.altered),
        Condition: record.condition,
        Language: record.language,
        "Purchase price currency": record.purchasePriceCurrency ?? "",
        Added: record.addedAt ?? "",
        Price: record.listingPrice.toFixed(2),
        "Target price": record.listingPrice.toFixed(2),
        Notes: record.notes,
      })),
    },
    {
      quotes: true,
      newline: "\r\n",
    },
  );
}
