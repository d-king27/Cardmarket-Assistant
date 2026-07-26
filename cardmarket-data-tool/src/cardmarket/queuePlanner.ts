import type {
  PreparedQueueBatch,
  PreparedQueueRecord,
  QueueIssue,
  QueuePlan,
  QueuePublishRequest,
  QueueSourceCard,
} from "./queueModels";
import { queuePublishRequestSchema } from "./queueModels";

const supportedRarities = new Map([
  ["common", "common"],
  ["uncommon", "uncommon"],
  ["rare", "rare"],
  ["mythic", "mythic"],
  ["mythic rare", "mythic"],
  ["special", "special"],
  ["token", "token"],
  ["land", "land"],
]);

export function planCardmarketQueue(rawRequest: QueuePublishRequest): QueuePlan {
  const request = queuePublishRequestSchema.parse(rawRequest);
  const blockers: QueueIssue[] = [];
  const warnings: QueueIssue[] = [];
  const readyRecords: PreparedQueueRecord[] = [];

  for (const card of request.cards) {
    const result = validateAndPrepareCard(card);
    blockers.push(...result.blockers);
    warnings.push(...result.warnings);
    if (result.record) readyRecords.push(result.record);
  }

  const batches = createBatches(readyRecords, request.settings.maximumRows);
  const blockedCardIds = new Set(blockers.map((issue) => issue.cardId));
  const preview = {
    settings: request.settings,
    sourceRecordCount: request.cards.length,
    readyRecordCount: readyRecords.length,
    blockedRecordCount: blockedCardIds.size,
    excludedRecordCount: request.settings.excludeBlockedRows ? blockedCardIds.size : 0,
    warningCount: warnings.length,
    batches: batches.map((batch) => ({
      batchId: batch.batchId,
      sequence: batch.sequence,
      filename: batch.filename,
      setCode: batch.setCode,
      setName: batch.setName,
      rarity: batch.rarity,
      rowCount: batch.rowCount,
      totalQuantity: batch.totalQuantity,
      sourceCardIds: batch.sourceCardIds,
    })),
    blockers,
    warnings,
  };

  return { preview, batches };
}

function validateAndPrepareCard(card: QueueSourceCard): {
  record?: PreparedQueueRecord;
  blockers: QueueIssue[];
  warnings: QueueIssue[];
} {
  const blockers: QueueIssue[] = [];
  const warnings: QueueIssue[] = [];
  const addIssue = (
    target: QueueIssue[],
    severity: QueueIssue["severity"],
    field: string,
    code: string,
    message: string,
  ) => {
    target.push({
      cardId: card.id,
      sourceRow: card.sourceRow,
      cardName: card.name || `Row ${card.sourceRow}`,
      severity,
      field,
      code,
      message,
    });
  };

  for (const issue of card.validationIssues) {
    addIssue(
      issue.severity === "error" ? blockers : warnings,
      issue.severity,
      issue.field,
      `inventory_${issue.code}`,
      issue.message,
    );
  }

  const name = card.name.trim();
  if (!name) addIssue(blockers, "error", "name", "name_required", "Card name is required.");

  if (!Number.isInteger(card.quantity) || card.quantity <= 0) {
    addIssue(blockers, "error", "quantity", "quantity_invalid", "Quantity must be a positive whole number.");
  }

  const setCode = sanitizeSetCode(card.setCode);
  const setName = card.setName.trim();
  if (!setCode && !setName) {
    addIssue(blockers, "error", "setCode", "set_required", "A set code or set name is required.");
  } else if (!setCode) {
    addIssue(
      warnings,
      "warning",
      "setCode",
      "set_code_missing",
      "Set code is missing; Cardmarket expansion matching will rely on the set name.",
    );
  }

  const rarity = normalizeRarity(card.rarity);
  if (!card.rarity.trim()) {
    addIssue(blockers, "error", "rarity", "rarity_required", "Rarity is required.");
  } else if (!rarity) {
    addIssue(
      blockers,
      "error",
      "rarity",
      "rarity_unsupported",
      `Unsupported Cardmarket rarity: ${card.rarity}.`,
    );
  }

  const finish = normalizeFinish(card.finish);
  if (finish === "etched") {
    addIssue(
      blockers,
      "error",
      "finish",
      "etched_unsupported",
      "Etched cards are blocked until the browser extension can represent them safely.",
    );
  } else if (!finish) {
    addIssue(
      blockers,
      "error",
      "finish",
      "finish_unsupported",
      `Unsupported finish: ${card.finish || "(empty)"}.`,
    );
  }

  if (card.targetPrice === null || !Number.isFinite(card.targetPrice) || card.targetPrice <= 0) {
    addIssue(
      blockers,
      "error",
      "targetPrice",
      "target_price_required",
      "Target price must be greater than zero before this row can be queued.",
    );
  }

  if (!card.condition.trim()) {
    addIssue(
      warnings,
      "warning",
      "condition",
      "condition_missing",
      "Condition is empty and will require review before filling Cardmarket.",
    );
  }
  if (!card.language.trim()) {
    addIssue(
      warnings,
      "warning",
      "language",
      "language_missing",
      "Language is empty and will require review before filling Cardmarket.",
    );
  }

  if (blockers.length > 0 || !rarity || (finish !== "normal" && finish !== "foil")) {
    return { blockers: deduplicateIssues(blockers), warnings: deduplicateIssues(warnings) };
  }

  return {
    record: {
      ...card,
      name,
      setCode,
      setName,
      finish,
      rarity,
      listingPrice: card.targetPrice!,
    },
    blockers: [],
    warnings: deduplicateIssues(warnings),
  };
}

function createBatches(records: PreparedQueueRecord[], maximumRows: number): PreparedQueueBatch[] {
  const groups = new Map<string, PreparedQueueRecord[]>();
  for (const record of records) {
    const key = [
      record.setCode.toLowerCase(),
      normalizeText(record.setName),
      record.rarity.toLowerCase(),
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const batches: PreparedQueueBatch[] = [];
  const orderedGroups = [...groups.values()].sort((left, right) => {
    const leftKey = `${left[0]?.setCode}|${left[0]?.setName}|${left[0]?.rarity}`;
    const rightKey = `${right[0]?.setCode}|${right[0]?.setName}|${right[0]?.rarity}`;
    return leftKey.localeCompare(rightKey, undefined, { numeric: true, sensitivity: "base" });
  });

  for (const group of orderedGroups) {
    const sorted = [...group].sort(comparePreparedRecords);
    for (let index = 0; index < sorted.length; index += maximumRows) {
      const chunk = sorted.slice(index, index + maximumRows);
      const sequence = batches.length + 1;
      const setCode = chunk[0]?.setCode || sanitizeSetCode(chunk[0]?.setName ?? "") || "UNKNOWN";
      const setName = chunk[0]?.setName ?? "";
      const rarity = chunk[0]?.rarity ?? "unknown";
      const stem = `${String(sequence).padStart(3, "0")}__${setCode}__${sanitizeFilenamePart(rarity)}`;
      batches.push({
        batchId: `batch-${String(sequence).padStart(3, "0")}`,
        sequence,
        filename: `${stem}.csv`,
        setCode,
        setName,
        rarity,
        rowCount: chunk.length,
        totalQuantity: chunk.reduce((sum, card) => sum + card.quantity, 0),
        sourceCardIds: chunk.map((card) => card.id),
        records: chunk,
      });
    }
  }

  return batches;
}

function comparePreparedRecords(left: PreparedQueueRecord, right: PreparedQueueRecord): number {
  return (
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
    left.collectorNumber.localeCompare(right.collectorNumber, undefined, { numeric: true }) ||
    left.finish.localeCompare(right.finish) ||
    left.language.localeCompare(right.language) ||
    left.condition.localeCompare(right.condition) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeFinish(value: string): "normal" | "foil" | "etched" | null {
  const normalized = normalizeText(value);
  if (!normalized || ["normal", "regular", "nonfoil", "non foil"].includes(normalized)) return "normal";
  if (normalized === "foil") return "foil";
  if (normalized === "etched" || normalized === "etched foil") return "etched";
  return null;
}

function normalizeRarity(value: string): string | null {
  return supportedRarities.get(normalizeText(value)) ?? null;
}

function sanitizeSetCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function sanitizeFilenamePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function deduplicateIssues(issues: QueueIssue[]): QueueIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.cardId}|${issue.severity}|${issue.field}|${issue.code}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
