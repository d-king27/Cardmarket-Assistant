import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  queueJobManifestSchema,
  type QueueJobManifest,
} from "@cardmarket-assistant/contracts";

import { scanCsvFile } from "./queueScanner.js";
import type { ProcessingPlanItem } from "./queueTypes.js";

export type QueueJobDiscoveryState = "ready" | "unavailable" | "invalid";

export interface DiscoveredQueueJob {
  directoryName: string;
  directoryPath: string;
  state: QueueJobDiscoveryState;
  manifest?: QueueJobManifest;
  items: ProcessingPlanItem[];
  error?: string;
}

export interface QueueRuntimeScan {
  runtimeDirectory: string;
  jobsDirectory: string;
  jobs: DiscoveredQueueJob[];
  actionableItems: ProcessingPlanItem[];
}

export interface ScanQueueRuntimeOptions {
  jobId?: string;
}

const JOB_ID_PATTERN = /^job-[a-zA-Z0-9-]+$/;

function resolveDirectChild(parent: string, fileName: string): string {
  if (
    fileName !== path.basename(fileName) ||
    fileName === "." ||
    fileName === ".."
  ) {
    throw new Error(`Manifest contains an unsafe CSV filename: ${fileName}`);
  }

  const candidate = path.resolve(parent, fileName);
  const relative = path.relative(path.resolve(parent), candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Manifest CSV path escapes its job directory: ${fileName}`);
  }
  return candidate;
}

function assertUniqueManifestValues(manifest: QueueJobManifest): void {
  if (manifest.batches.length === 0) {
    throw new Error("Ready queue manifest contains no batches");
  }

  const identifiers = new Set<string>();
  const filenames = new Set<string>();
  const sequences = new Set<number>();

  for (const batch of manifest.batches) {
    const normalizedFilename = batch.filename.toLowerCase();
    if (
      batch.filename !== path.basename(batch.filename) ||
      batch.filename === "." ||
      batch.filename === ".." ||
      path.extname(batch.filename).toLowerCase() !== ".csv"
    ) {
      throw new Error(
        `Manifest contains an unsafe CSV filename: ${batch.filename}`,
      );
    }
    if (identifiers.has(batch.batchId)) {
      throw new Error(`Manifest contains duplicate batch ID: ${batch.batchId}`);
    }
    if (filenames.has(normalizedFilename)) {
      throw new Error(`Manifest contains duplicate CSV filename: ${batch.filename}`);
    }
    if (sequences.has(batch.sequence)) {
      throw new Error(`Manifest contains duplicate batch sequence: ${batch.sequence}`);
    }
    identifiers.add(batch.batchId);
    filenames.add(normalizedFilename);
    sequences.add(batch.sequence);
  }

  if (manifest.summary.batchCount !== manifest.batches.length) {
    throw new Error(
      `Manifest batch count ${manifest.summary.batchCount} does not match ${manifest.batches.length} batch entries`,
    );
  }
  const queuedRecordCount = manifest.batches.reduce(
    (total, batch) => total + batch.rowCount,
    0,
  );
  if (manifest.summary.queuedRecordCount !== queuedRecordCount) {
    throw new Error(
      `Manifest queued record count ${manifest.summary.queuedRecordCount} does not match ${queuedRecordCount} batch rows`,
    );
  }
}

async function assertExpectedCsvFiles(
  csvDirectory: string,
  manifest: QueueJobManifest,
): Promise<void> {
  const entries = await readdir(csvDirectory, { withFileTypes: true });
  const actualCsvFiles = entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === ".csv",
    )
    .map((entry) => entry.name.toLowerCase())
    .sort();
  const expectedCsvFiles = manifest.batches
    .map((batch) => batch.filename.toLowerCase())
    .sort();

  const extraFiles = actualCsvFiles.filter(
    (fileName) => !expectedCsvFiles.includes(fileName),
  );
  if (extraFiles.length > 0) {
    throw new Error(
      `Job CSV directory contains files not declared by the manifest: ${extraFiles.join(", ")}`,
    );
  }
}

function batchStatusToPlanStatus(
  status: QueueJobManifest["batches"][number]["status"],
): ProcessingPlanItem["status"] {
  switch (status) {
    case "pending":
    case "processing":
      return "pending";
    case "succeeded":
      return "succeeded";
    case "partial":
    case "failed":
      return "failed";
  }
}

async function discoverJob(
  jobsDirectory: string,
  directoryName: string,
): Promise<DiscoveredQueueJob> {
  const directoryPath = path.join(jobsDirectory, directoryName);

  try {
    if (!JOB_ID_PATTERN.test(directoryName)) {
      throw new Error(`Queue job directory has an invalid name: ${directoryName}`);
    }

    const directoryStats = await lstat(directoryPath);
    if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
      throw new Error(`Queue job path is not a regular directory: ${directoryName}`);
    }

    const manifestPath = path.join(directoryPath, "manifest.json");
    const manifestStats = await lstat(manifestPath);
    if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
      throw new Error("manifest.json is not a regular file");
    }

    const candidate = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    const parsed = queueJobManifestSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`Manifest validation failed: ${parsed.error.message}`);
    }
    const manifest = parsed.data;

    if (manifest.jobId !== directoryName) {
      throw new Error(
        `Manifest job ID ${manifest.jobId} does not match directory ${directoryName}`,
      );
    }

    assertUniqueManifestValues(manifest);
    const csvDirectory = path.join(directoryPath, "csv");
    await assertExpectedCsvFiles(csvDirectory, manifest);

    const items: ProcessingPlanItem[] = [];
    for (const batch of [...manifest.batches].sort(
      (left, right) => left.sequence - right.sequence,
    )) {
      const csvPath = resolveDirectChild(csvDirectory, batch.filename);
      const csvStats = await lstat(csvPath);
      if (!csvStats.isFile() || csvStats.isSymbolicLink()) {
        throw new Error(`Batch CSV is not a regular file: ${batch.filename}`);
      }

      const item = await scanCsvFile(csvPath, {
        expected: {
          batchId: batch.batchId,
          fingerprint: batch.sha256,
          rowCount: batch.rowCount,
          totalQuantity: batch.totalQuantity,
          setCode: batch.setCode,
          setName: batch.setName,
          rarity: batch.rarity,
        },
        source: {
          kind: "queue-job",
          jobId: manifest.jobId,
          batchId: batch.batchId,
          manifestPath,
        },
      });
      item.id = `${manifest.jobId}--${batch.batchId}`;
      if (item.status !== "invalid") {
        item.status = batchStatusToPlanStatus(batch.status);
      }
      if (batch.status === "processing") {
        item.notes.push({
          at: new Date().toISOString(),
          kind: "info",
          message: "Recovered a manifest batch marked processing back to pending.",
        });
      }
      items.push(item);
    }

    const invalidItem = items.find((item) => item.status === "invalid");
    if (invalidItem !== undefined) {
      return {
        directoryName,
        directoryPath,
        state: "invalid",
        manifest,
        items,
        error:
          invalidItem.validationError ??
          `Batch validation failed: ${invalidItem.fileName}`,
      };
    }

    return {
      directoryName,
      directoryPath,
      state: manifest.status === "ready" ? "ready" : "unavailable",
      manifest,
      items,
      ...(manifest.status === "ready"
        ? {}
        : { error: `Job status is ${manifest.status}, not ready` }),
    };
  } catch (error) {
    return {
      directoryName,
      directoryPath,
      state: "invalid",
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function scanQueueRuntime(
  runtimeDirectory: string,
  options: ScanQueueRuntimeOptions = {},
): Promise<QueueRuntimeScan> {
  const resolvedRuntime = path.resolve(runtimeDirectory);
  const jobsDirectory = path.join(resolvedRuntime, "jobs");

  if (options.jobId !== undefined && !JOB_ID_PATTERN.test(options.jobId)) {
    throw new Error(`Invalid queue job ID: ${options.jobId}`);
  }

  const entries = await readdir(jobsDirectory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    },
  );
  const directoryNames = entries
    .filter(
      (entry) =>
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        !entry.name.startsWith(".staging-"),
    )
    .map((entry) => entry.name)
    .filter(
      (directoryName) =>
        options.jobId === undefined || directoryName === options.jobId,
    );

  if (options.jobId !== undefined && directoryNames.length === 0) {
    throw new Error(
      `Queue job ${options.jobId} was not found under ${jobsDirectory}`,
    );
  }

  const jobs = await Promise.all(
    directoryNames.map((directoryName) =>
      discoverJob(jobsDirectory, directoryName),
    ),
  );
  jobs.sort((left, right) => {
    const leftCreated = left.manifest?.createdAt ?? "";
    const rightCreated = right.manifest?.createdAt ?? "";
    return (
      rightCreated.localeCompare(leftCreated) ||
      left.directoryName.localeCompare(right.directoryName)
    );
  });

  return {
    runtimeDirectory: resolvedRuntime,
    jobsDirectory,
    jobs,
    actionableItems: jobs.flatMap((job) =>
      job.state === "ready"
        ? job.items.filter(
            (item) => item.status === "pending" || item.status === "failed",
          )
        : [],
    ),
  };
}

function jobStateSymbol(state: QueueJobDiscoveryState): string {
  switch (state) {
    case "ready":
      return "✓";
    case "unavailable":
      return "○";
    case "invalid":
      return "✗";
  }
}

export function formatQueueRuntimeScan(scan: QueueRuntimeScan): string {
  const lines = [`Queue runtime: ${scan.runtimeDirectory}`, ""];

  if (scan.jobs.length === 0) {
    lines.push("No published queue jobs found.");
  }

  for (const job of scan.jobs) {
    const collection = job.manifest?.collection.name ?? "Unreadable manifest";
    const status = job.manifest?.status.toUpperCase() ?? "INVALID";
    lines.push(
      `${jobStateSymbol(job.state)} ${job.directoryName} ${status} — ${collection}`,
    );

    if (job.error !== undefined) {
      lines.push(`    ${job.error}`);
    }

    for (const item of job.items) {
      const target =
        item.target === undefined
          ? item.validationError ?? "Invalid CSV"
          : `${item.target.setCode ?? item.target.setTag} | ${item.target.rarity} | ${item.validation?.rowCount ?? 0} rows`;
      lines.push(
        `    ${item.status === "invalid" ? "✗" : "·"} ${item.fileName} — ${target}`,
      );
    }
  }

  const ready = scan.jobs.filter((job) => job.state === "ready").length;
  const invalid = scan.jobs.filter((job) => job.state === "invalid").length;
  const unavailable = scan.jobs.filter(
    (job) => job.state === "unavailable",
  ).length;
  lines.push(
    "",
    `Jobs ${scan.jobs.length} | Ready ${ready} | Unavailable ${unavailable} | Invalid ${invalid} | Actionable batches ${scan.actionableItems.length}`,
  );
  return `${lines.join("\n")}\n`;
}
