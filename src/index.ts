import path from "node:path";

import { loadBatch } from "./batchLoader.js";
import {
  launchBrowserSession,
  waitForBrowserToClose,
} from "./browserSession.js";
import { openCardmarketSetPage } from "./cardmarketNavigator.js";
import { getHelpText, parseCliArguments } from "./cli.js";
import { createConfig } from "./config.js";
import { stageSetCsv } from "./csvStager.js";
import { CardmarketCsvImportBridge } from "./extensionBridge.js";
import { validateExtensionBuild } from "./extensionLoader.js";
import { writeDryRunReport } from "./resultWriter.js";
import { selectSetBatch } from "./setPlanner.js";
import type { DryRunReport } from "./types.js";

async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));

  if (cli.help) {
    process.stdout.write(getHelpText());
    return;
  }

  const config = createConfig(cli);
  const batch = await loadBatch(config.batchPath);
  const setBatch = selectSetBatch(batch, config.requestedSet);
  const extension = await validateExtensionBuild(config.extensionPath);

  console.log(
    `Validated batch ${batch.batchId} (${batch.records.length} records).`,
  );
  console.log(`Loading ${extension.name} ${extension.version}.`);

  const session = await launchBrowserSession(config);

  try {
    const pageContext = await openCardmarketSetPage(
      session.page,
      config.cardmarketUrl,
      setBatch,
    );
    const stagedCsvPath = await stageSetCsv(
      path.join(config.reportsPath, "staged"),
      setBatch,
    );
    const bridge = new CardmarketCsvImportBridge();
    const outcome = await bridge.requestDryRun({
      page: session.page,
      fullBatch: batch,
      setBatch,
      stagedCsvPath,
      pageContext,
    });
    const generatedAt = new Date().toISOString();
    const report: DryRunReport = {
      reportVersion: 1,
      reportType: "playwright-companion-dry-run",
      generatedAt,
      input: {
        batchFile: path.basename(config.batchPath),
        recordCount: batch.records.length,
      },
      bridge: {
        adapter: bridge.adapterName,
        mocked: bridge.mocked,
      },
      set: {
        ...(setBatch.setCode === undefined ? {} : { code: setBatch.setCode }),
        ...(setBatch.setName === undefined ? {} : { name: setBatch.setName }),
        stagedRecordCount: setBatch.records.length,
      },
      importPreview: outcome.preview,
      result: outcome.result,
    };
    const reportPath = await writeDryRunReport(config.reportsPath, report);

    console.log(`Dry-run import preview report written to ${reportPath}`);

    if (config.headed) {
      console.log("Browser left open for manual review. Close it to exit.");
      await waitForBrowserToClose(session.context);
    }
  } finally {
    if (!config.headed) {
      await session.context.close();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
