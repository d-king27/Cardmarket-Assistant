import path from "node:path";

import { getHelpText, parseCliArguments } from "./cli.js";
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
