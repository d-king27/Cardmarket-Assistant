import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ProcessingPlanSchema,
  type PlanSummary,
  type ProcessingPlan,
  type ProcessingPlanItem,
} from "./queueTypes.js";
import type { QueueTarget } from "./queueTypes.js";

export function formatTargetSet(target: QueueTarget): string {
  if (target.setName !== undefined && target.setCode !== undefined) {
    return `${target.setName} [${target.setCode}]`;
  }

  return target.setName ?? target.setCode ?? target.setTag;
}

export function summarizeItems(items: ProcessingPlanItem[]): PlanSummary {
  return {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    running: items.filter((item) => item.status === "running").length,
    succeeded: items.filter((item) => item.status === "succeeded").length,
    failed: items.filter((item) => item.status === "failed").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    invalid: items.filter((item) => item.status === "invalid").length,
  };
}

function historyKey(item: ProcessingPlanItem): string {
  if (item.source?.kind === "queue-job") {
    return `${item.source.jobId}\0${item.source.batchId}\0${item.fingerprint}`;
  }
  return `${item.fileName}\0${item.fingerprint}`;
}

export async function loadProcessingPlan(
  planPath: string,
): Promise<ProcessingPlan> {
  let candidate: unknown;

  try {
    candidate = JSON.parse(await readFile(planPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Unable to read processing plan: ${planPath}`, {
      cause: error,
    });
  }

  const parsed = ProcessingPlanSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(`Processing plan is invalid: ${parsed.error.message}`);
  }

  return parsed.data;
}

export async function loadProcessingPlanIfPresent(
  planPath: string,
): Promise<ProcessingPlan | undefined> {
  try {
    return await loadProcessingPlan(planPath);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

export function createOrRefreshProcessingPlan(input: {
  inputDirectory: string;
  scannedItems: ProcessingPlanItem[];
  previousPlan?: ProcessingPlan;
}): ProcessingPlan {
  if (
    input.previousPlan !== undefined &&
    path.resolve(input.previousPlan.inputDirectory) !==
      path.resolve(input.inputDirectory)
  ) {
    throw new Error(
      `Plan ${input.previousPlan.planId} belongs to ${input.previousPlan.inputDirectory}, not ${input.inputDirectory}. Use a different --plan path for this input directory.`,
    );
  }

  const now = new Date().toISOString();
  const previousByFingerprint = new Map(
    input.previousPlan?.items.map((item) => [
      historyKey(item),
      item,
    ]) ?? [],
  );
  const items = input.scannedItems.map((scannedItem) => {
    const previous = previousByFingerprint.get(
      historyKey(scannedItem),
    );

    if (previous === undefined || scannedItem.status === "invalid") {
      return scannedItem;
    }

    if (previous.status === "running") {
      return {
        ...scannedItem,
        status: "pending" as const,
        attempts: previous.attempts,
        ...(previous.staging === undefined
          ? {}
          : { staging: previous.staging }),
        notes: [
          ...previous.notes,
          {
            at: now,
            kind: "info" as const,
            message: "Recovered an interrupted running item back to pending.",
          },
        ],
      };
    }

    return {
      ...scannedItem,
      status: previous.status,
      attempts: previous.attempts,
      notes: previous.notes,
      ...(previous.staging === undefined
        ? {}
        : { staging: previous.staging }),
    };
  });
  const plan: ProcessingPlan = {
    planVersion: 1,
    planId:
      input.previousPlan?.planId ??
      `plan-${now.replace(/[:.]/g, "-")}`,
    inputDirectory: input.inputDirectory,
    createdAt: input.previousPlan?.createdAt ?? now,
    updatedAt: now,
    summary: summarizeItems(items),
    items,
  };

  return ProcessingPlanSchema.parse(plan);
}

export async function saveProcessingPlan(
  planPath: string,
  plan: ProcessingPlan,
): Promise<void> {
  plan.updatedAt = new Date().toISOString();
  plan.summary = summarizeItems(plan.items);
  const validated = ProcessingPlanSchema.parse(plan);
  await mkdir(path.dirname(planPath), { recursive: true });
  const temporaryPath = `${planPath}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, planPath);
}

function statusSymbol(item: ProcessingPlanItem): string {
  switch (item.status) {
    case "succeeded":
      return "✓";
    case "failed":
    case "invalid":
      return "✗";
    case "skipped":
      return "○";
    case "running":
      return "▶";
    case "pending":
      return "·";
  }
}

export function formatPlan(plan: ProcessingPlan): string {
  const lines = [
    `Processing plan: ${plan.planId}`,
    `Input: ${plan.inputDirectory}`,
    "",
  ];

  for (const [index, item] of plan.items.entries()) {
    const target =
      item.target === undefined
        ? item.validationError ?? "Invalid CSV"
        : `${formatTargetSet(item.target)} | ${item.target.rarity} | ${item.validation?.rowCount ?? 0} rows`;
    lines.push(
      `${statusSymbol(item)} ${String(index + 1).padStart(2, "0")} ${item.status.toUpperCase().padEnd(9)} ${item.fileName} — ${target}`,
    );
    if (item.source?.kind === "queue-job") {
      lines.push(`     job: ${item.source.jobId} | batch: ${item.source.batchId}`);
    }
    if (item.staging !== undefined) {
      lines.push(
        `     staged: ${item.staging.state} | ${item.staging.selectedCount}/${item.staging.eligibleCount} selected | ${item.staging.resultPath}`,
      );
    }
    const lastNote = item.notes.at(-1);
    if (lastNote !== undefined) {
      lines.push(`     note: ${lastNote.message}`);
    }
  }

  const summary = plan.summary;
  lines.push(
    "",
    `Total ${summary.total} | Pending ${summary.pending} | Running ${summary.running} | Passed ${summary.succeeded} | Failed ${summary.failed} | Skipped ${summary.skipped} | Invalid ${summary.invalid}`,
  );
  return `${lines.join("\n")}\n`;
}
