import path from "node:path";

import { getHelpText, parseCliArguments } from "./cli.js";
import { runAttachedDemo } from "./attachedDemo.js";
import { runOperatorQueue } from "./operatorQueue.js";
import {
  createOrRefreshProcessingPlan,
  formatPlan,
  loadProcessingPlan,
  loadProcessingPlanIfPresent,
  saveProcessingPlan,
} from "./processingPlan.js";
import { scanCsvDirectory } from "./queueScanner.js";

const DEFAULT_INPUT_DIRECTORY = "inbox";
const DEFAULT_PLAN_PATH = path.join("reports", "processing-plan.json");

async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));

  if (cli.help || cli.command === undefined) {
    process.stdout.write(getHelpText());
    return;
  }

  const planPath = path.resolve(cli.planPath ?? DEFAULT_PLAN_PATH);

  if (cli.command === "plan") {
    const inputDirectory = path.resolve(
      cli.inputDir ?? DEFAULT_INPUT_DIRECTORY,
    );
    const scannedItems = await scanCsvDirectory(inputDirectory);
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

  if (cli.command === "demo") {
    const result = await runAttachedDemo({
      plan,
      cdpEndpoint: cli.cdpEndpoint ?? "http://127.0.0.1:9222",
    });
    process.stdout.write(
      `\nPlaywright demo prepared ${result.item.fileName}\n` +
        `Set: ${result.pageContext.expansionLabel ?? "unknown"}\n` +
        `Rarity: ${result.item.target?.rarity ?? "unknown"}\n` +
        `Hits: ${result.pageContext.hitCount ?? "unknown"}\n` +
        `Extension preview: ${result.preview.selectedCount} selected of ${result.preview.eligibleCount} (${result.preview.parsedCount} total)\n` +
        "Stopped safely before Fill Page. Chrome remains open for screenshots and review.\n",
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
