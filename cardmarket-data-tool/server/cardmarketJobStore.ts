import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CARDMARKET_QUEUE_VERSION,
  queueJobManifestSchema,
  queuePublishRequestSchema,
} from "../src/cardmarket/queueModels";
import type {
  QueueJobManifest,
  QueuePublishRequest,
} from "../src/cardmarket/queueModels";
import { serializeCardmarketQueueCsv } from "../src/cardmarket/queueCsv";
import { planCardmarketQueue } from "../src/cardmarket/queuePlanner";

export class QueueJobError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QueueJobError";
  }
}

export interface PublishedQueueJob {
  manifest: QueueJobManifest;
  directory: string;
}

export function defaultRuntimeDirectory(cwd = process.cwd()): string {
  const configured = process.env.CARDMARKET_RUNTIME_DIR;
  return configured ? path.resolve(cwd, configured) : path.resolve(cwd, "..", ".runtime");
}

export async function publishQueueJob(
  rawRequest: QueuePublishRequest,
  options: {
    runtimeDirectory?: string;
    now?: Date;
    jobId?: string;
  } = {},
): Promise<PublishedQueueJob> {
  const request = queuePublishRequestSchema.parse(rawRequest);
  const plan = planCardmarketQueue(request);

  if (plan.preview.blockedRecordCount > 0 && !request.settings.excludeBlockedRows) {
    throw new QueueJobError(
      `${plan.preview.blockedRecordCount} record(s) are blocked. Correct them or explicitly exclude blocked rows.`,
      422,
    );
  }
  if (plan.batches.length === 0) {
    throw new QueueJobError("No valid records are available to publish.", 422);
  }

  const runtimeDirectory = path.resolve(options.runtimeDirectory ?? defaultRuntimeDirectory());
  const jobsDirectory = path.join(runtimeDirectory, "jobs");
  const now = options.now ?? new Date();
  const jobId = options.jobId ?? createJobId(now);
  assertJobId(jobId);
  const finalDirectory = path.join(jobsDirectory, jobId);
  const stagingDirectory = path.join(jobsDirectory, `.staging-${jobId}-${randomUUID().slice(0, 8)}`);
  assertChildPath(jobsDirectory, finalDirectory);
  assertChildPath(jobsDirectory, stagingDirectory);

  await mkdir(path.join(stagingDirectory, "csv"), { recursive: true });
  await mkdir(path.join(stagingDirectory, "results"), { recursive: true });

  try {
    const manifestBatches = [];
    for (const batch of plan.batches) {
      const csv = serializeCardmarketQueueCsv(batch.records);
      const csvPath = path.join(stagingDirectory, "csv", batch.filename);
      assertChildPath(path.join(stagingDirectory, "csv"), csvPath);
      await writeFile(csvPath, csv, "utf8");
      manifestBatches.push({
        batchId: batch.batchId,
        sequence: batch.sequence,
        filename: batch.filename,
        setCode: batch.setCode,
        setName: batch.setName,
        rarity: batch.rarity,
        rowCount: batch.rowCount,
        totalQuantity: batch.totalQuantity,
        sha256: createHash("sha256").update(csv).digest("hex"),
        status: "pending" as const,
      });
    }

    const manifest = queueJobManifestSchema.parse({
      jobVersion: CARDMARKET_QUEUE_VERSION,
      jobId,
      status: "ready",
      createdAt: now.toISOString(),
      collection: {
        id: request.collectionId,
        name: request.collectionName,
      },
      settings: request.settings,
      summary: {
        sourceRecordCount: plan.preview.sourceRecordCount,
        queuedRecordCount: plan.preview.readyRecordCount,
        excludedRecordCount: plan.preview.excludedRecordCount,
        warningCount: plan.preview.warningCount,
        batchCount: manifestBatches.length,
      },
      batches: manifestBatches,
      excludedRows: request.settings.excludeBlockedRows ? plan.preview.blockers : [],
      warnings: plan.preview.warnings,
    });

    await writeFile(
      path.join(stagingDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    await rename(stagingDirectory, finalDirectory);
    return { manifest, directory: finalDirectory };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    if (isAlreadyExistsError(error)) {
      throw new QueueJobError(`Queue job already exists: ${jobId}`, 409);
    }
    throw error;
  }
}

export async function listQueueJobs(runtimeDirectory = defaultRuntimeDirectory()): Promise<QueueJobManifest[]> {
  const jobsDirectory = path.join(path.resolve(runtimeDirectory), "jobs");
  const entries = await readdir(jobsDirectory, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });
  const manifests = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".staging-"))
      .map(async (entry) => {
        assertJobId(entry.name);
        const manifestPath = path.join(jobsDirectory, entry.name, "manifest.json");
        const candidate = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
        return queueJobManifestSchema.parse(candidate);
      }),
  );
  return manifests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getQueueJob(
  jobId: string,
  runtimeDirectory = defaultRuntimeDirectory(),
): Promise<PublishedQueueJob | null> {
  assertJobId(jobId);
  const jobsDirectory = path.join(path.resolve(runtimeDirectory), "jobs");
  const directory = path.join(jobsDirectory, jobId);
  assertChildPath(jobsDirectory, directory);
  try {
    const candidate = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")) as unknown;
    return { manifest: queueJobManifestSchema.parse(candidate), directory };
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

function createJobId(now: Date): string {
  const timestamp = now.toISOString().replace(/[^0-9A-Za-z]+/g, "-").replace(/-+$/g, "");
  return `job-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function assertJobId(value: string): void {
  if (!/^job-[a-zA-Z0-9-]+$/.test(value)) {
    throw new QueueJobError("Invalid queue job ID.", 400);
  }
}

function assertChildPath(parent: string, candidate: string): void {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new QueueJobError("Queue path escaped the configured runtime directory.", 400);
  }
}

function isMissingPathError(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function isAlreadyExistsError(error: unknown): boolean {
  return isNodeError(error) && (error.code === "EEXIST" || error.code === "ENOTEMPTY");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
