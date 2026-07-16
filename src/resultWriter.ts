import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DryRunReport } from "./types.js";

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function writeDryRunReport(
  reportsPath: string,
  report: DryRunReport,
): Promise<string> {
  await mkdir(reportsPath, { recursive: true });

  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const batchId = safeFilePart(report.result.batchId) || "batch";
  const reportPath = path.join(
    reportsPath,
    `${timestamp}-${batchId}-dry-run.json`,
  );

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}
