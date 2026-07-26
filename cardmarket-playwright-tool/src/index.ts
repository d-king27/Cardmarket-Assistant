import path from "node:path";

import { getHelpText, parseCliArguments } from "./cli.js";
import { runAttachedStage } from "./attachedDemo.js";
import { runOperatorQueue } from "./operatorQueue.js";
import {
  createOrRefreshProcessingPlan,
  formatPlan,
  loadProcessingPlan,
  loadProcessingPlanIfPresent,
  saveProcessingPlan,
} from "./processingPlan.js";
import {
  formatQueueRuntimeScan,
  scanQueueRuntime,
} from "./queueJobScanner.js";
import { scanCsvDirectory } from "./queueScanner.js";
import type { ProcessingPlanItem } from "./queueTypes.js";

const DEFAULT_PLAN_PATH = path.join("reports", "processing-plan.json");
const DEFAULT_RUNTIME_DIRECTORY = path.join("..", ".runtime");

async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));

  if (cli.help || cli.command === undefined) {
    process.stdout.write(getHelpText());
    return;
  }

  const planPath = path.resolve(cli.planPath ?? DEFAULT_PLAN_PATH);
  const runtimeDirectory = path.resolve(
    cli.runtimeDir ??
      process.env.CARDMARKET_RUNTIME_DIR ??
      DEFAULT_RUNTIME_DIRECTORY,
  );

  if (cli.command === "jobs") {
    if (cli.inputDir !== undefined) {
      throw new Error("The jobs command does not accept --input-dir");
    }
    const scan = await scanQueueRuntime(runtimeDirectory, {
      ...(cli.jobId === undefined ? {} : { jobId: cli.jobId }),
    });
    process.stdout.write(formatQueueRuntimeScan(scan));
    return;
  }

  if (cli.command === "plan") {
    if (cli.inputDir !== undefined && cli.jobId !== undefined) {
      throw new Error("--job cannot be combined with --input-dir");
    }

    let inputDirectory: string;
    let scannedItems: ProcessingPlanItem[];
    if (cli.inputDir !== undefined) {
      inputDirectory = path.resolve(cli.inputDir);
      scannedItems = await scanCsvDirectory(inputDirectory);
    } else {
      const scan = await scanQueueRuntime(runtimeDirectory, {
        ...(cli.jobId === undefined ? {} : { jobId: cli.jobId }),
      });
      process.stdout.write(formatQueueRuntimeScan(scan));
      if (scan.jobs.length === 0) {
        throw new Error(
          "No queue jobs were found. Publish a job in the data tool or use --input-dir for a legacy CSV directory.",
        );
      }
      if (scan.actionableItems.length === 0) {
        throw new Error(
          "No validated batches are available to add to a processing plan.",
        );
      }
      inputDirectory = scan.runtimeDirectory;
      scannedItems = scan.actionableItems;
    }
    const previousPlan = await loadProcessingPlanIfPresent(planPath);
    const plan = createOrRefreshProcessingPlan({
      inputDirectory,
      scannedItems,
      ...(previousPlan === undefined ? {} : { previousPlan }),
    });
    await saveProcessingPlan(planPath, plan);
    process.stdout.write(formatPlan(plan));
    process.stdout.write(`\nSaved: ${planPath}\n`);
    return;
  }

  const plan = await loadProcessingPlan(planPath);

  if (cli.command === "status") {
    process.stdout.write(formatPlan(plan));
    return;
  }

  if (cli.command === "stage" || cli.command === "demo") {
    const result = await runAttachedStage({
      plan,
      planPath,
      cdpEndpoint: cli.cdpEndpoint ?? "http://127.0.0.1:9222",
      selection: {
        ...(cli.jobId === undefined ? {} : { jobId: cli.jobId }),
        ...(cli.batchId === undefined ? {} : { batchId: cli.batchId }),
        retryFailed: cli.retryFailed,
      },
    });
    process.stdout.write(
      `\nStaged ${result.item.fileName}\n` +
        (result.item.source?.kind === "queue-job"
          ? `Job: ${result.item.source.jobId}\nBatch: ${result.item.source.batchId}\n`
          : "") +
        `Set: ${result.pageContext.expansionLabel ?? "unknown"}\n` +
        `Rarity: ${result.item.target?.rarity ?? "unknown"}\n` +
        `Hits: ${result.pageContext.hitCount ?? "unknown"}\n` +
        `Extension preview: ${result.preview.selectedCount} selected of ${result.preview.eligibleCount} (${result.preview.parsedCount} total)\n` +
        `Dry-run result: ${result.resultPath}\n` +
        "Stopped safely before Fill Page. Chrome remains open for manual review.\n",
    );
    return;
  }

  await runOperatorQueue({
    plan,
    planPath,
    retryFailed: cli.retryFailed,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
