import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { ListingBatchResultMessageSchema } from "./types.js";
import type { ProcessingPlanItem } from "./queueTypes.js";
import type { ListingBatchResultMessage } from "./types.js";

function safeFilePart(value: string): string {
  return (
    value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "batch"
  );
}

async function queueJobResultsDirectory(
  item: ProcessingPlanItem,
): Promise<string | undefined> {
  if (item.source?.kind !== "queue-job") {
    return undefined;
  }

  const manifestPath = path.resolve(item.source.manifestPath);
  if (path.basename(manifestPath) !== "manifest.json") {
    throw new Error("Queue item manifest path does not end in manifest.json");
  }
  const jobDirectory = path.dirname(manifestPath);
  if (path.basename(jobDirectory) !== item.source.jobId) {
    throw new Error("Queue item manifest path does not match its job ID");
  }

  const resultsDirectory = path.join(jobDirectory, "results");
  const stats = await lstat(resultsDirectory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Queue job results path is not a regular directory");
  }
  return resultsDirectory;
}

export async function saveStageResult(input: {
  item: ProcessingPlanItem;
  result: ListingBatchResultMessage;
  fallbackResultsDirectory: string;
  now?: Date;
}): Promise<string> {
  const validated = ListingBatchResultMessageSchema.parse(input.result);
  const queueResults = await queueJobResultsDirectory(input.item);
  const resultsDirectory =
    queueResults ?? path.resolve(input.fallbackResultsDirectory);
  if (queueResults === undefined) {
    await mkdir(resultsDirectory, { recursive: true });
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString().replace(/[^0-9A-Za-z]+/g, "-");
  const correlationId =
    input.item.source?.kind === "queue-job"
      ? input.item.source.batchId
      : input.item.id;
  const resultId = randomUUID().slice(0, 8);
  const fileName = `${safeFilePart(correlationId)}__${timestamp}__${resultId}__dry-run.json`;
  const finalPath = path.join(resultsDirectory, fileName);
  const temporaryPath = `${finalPath}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, finalPath);
  return finalPath;
}
