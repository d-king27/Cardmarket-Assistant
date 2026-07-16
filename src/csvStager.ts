import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { stringify } from "csv-stringify/sync";

import type { SetBatch } from "./types.js";

export const SAFE_IMPORT_COLUMNS = {
  name: "Name",
  language: "Language",
  condition: "Condition",
  set: "Set code",
  foil: "Foil",
  quantity: "Quantity",
} as const;

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildSafeImportCsv(set: SetBatch): string {
  const rows = set.records.map((record) => ({
    [SAFE_IMPORT_COLUMNS.name]: record.name,
    [SAFE_IMPORT_COLUMNS.language]: record.language ?? "",
    [SAFE_IMPORT_COLUMNS.condition]: record.condition ?? "",
    [SAFE_IMPORT_COLUMNS.set]: record.setCode ?? "",
    [SAFE_IMPORT_COLUMNS.foil]: record.finish ?? "",
    [SAFE_IMPORT_COLUMNS.quantity]: record.quantity,
  }));
  return stringify(rows, {
    header: true,
    columns: Object.values(SAFE_IMPORT_COLUMNS),
  });
}

export async function stageSetCsv(
  stagedDirectory: string,
  set: SetBatch,
): Promise<string> {
  await mkdir(stagedDirectory, { recursive: true });

  const csv = buildSafeImportCsv(set);
  const setPart = safeFilePart(set.setCode ?? set.setName ?? "set") || "set";
  const stagedPath = path.join(stagedDirectory, `${setPart}-safe-import.csv`);

  await writeFile(stagedPath, csv, "utf8");
  return stagedPath;
}
