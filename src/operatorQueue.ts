import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  formatPlan,
  formatTargetSet,
  saveProcessingPlan,
  summarizeItems,
} from "./processingPlan.js";
import type {
  ProcessingNote,
  ProcessingPlan,
  ProcessingPlanItem,
} from "./queueTypes.js";

function addNote(
  item: ProcessingPlanItem,
  kind: ProcessingNote["kind"],
  message: string,
): void {
  if (message.trim() === "") {
    return;
  }
  item.notes.push({
    at: new Date().toISOString(),
    kind,
    message: message.trim(),
  });
}

function normalizeChoice(value: string): string {
  return value.trim().toLowerCase();
}

export async function runOperatorQueue(input: {
  plan: ProcessingPlan;
  planPath: string;
  retryFailed: boolean;
}): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Queue mode requires an interactive terminal");
  }

  for (const item of input.plan.items) {
    if (item.status === "running") {
      item.status = "pending";
      addNote(item, "info", "Recovered from an interrupted queue run.");
    }
  }
  input.plan.summary = summarizeItems(input.plan.items);
  await saveProcessingPlan(input.planPath, input.plan);

  const candidates = input.plan.items.filter(
    (item) =>
      item.status === "pending" ||
      (input.retryFailed && item.status === "failed"),
  );

  if (candidates.length === 0) {
    stdout.write("No pending queue items.\n");
    stdout.write(formatPlan(input.plan));
    return;
  }

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(
      "Open normal Chrome yourself, confirm the extension is installed, and keep all Cardmarket navigation and submission manual.\n\n",
    );

    for (const [index, item] of candidates.entries()) {
      item.status = "running";
      item.attempts += 1;
      addNote(item, "info", `Started operator attempt ${item.attempts}.`);
      await saveProcessingPlan(input.planPath, input.plan);

      stdout.write(
        `▶ RUN ${index + 1}/${candidates.length}: ${item.fileName}\n` +
          `  Set: ${item.target === undefined ? "unknown" : formatTargetSet(item.target)}\n` +
          `  Rarity: ${item.target?.rarity ?? "unknown"}\n` +
          `  Rows: ${item.validation?.rowCount ?? 0}\n` +
          `  File: ${item.filePath}\n` +
          "  In normal Chrome, navigate to this set and rarity, import the CSV with the extension, review Fill Page, and submit only when you choose.\n",
      );

      let choice = "";
      while (!["p", "pass", "f", "fail", "s", "skip", "q", "quit"].includes(choice)) {
        choice = normalizeChoice(
          await readline.question(
            "Result [p]ass / [f]ail / [s]kip / [q]uit: ",
          ),
        );
      }

      if (choice === "q" || choice === "quit") {
        item.status = "pending";
        addNote(item, "info", "Operator quit before recording a result.");
        await saveProcessingPlan(input.planPath, input.plan);
        stdout.write("Queue paused. Progress has been saved.\n");
        return;
      }

      const note = await readline.question("Optional note: ");

      if (choice === "p" || choice === "pass") {
        item.status = "succeeded";
        addNote(item, "success", note || "Operator marked the CSV successful.");
        stdout.write(`✓ PASS ${item.fileName}\n\n`);
      } else if (choice === "f" || choice === "fail") {
        item.status = "failed";
        addNote(item, "failure", note || "Operator marked the CSV failed.");
        stdout.write(`✗ FAIL ${item.fileName}\n\n`);
      } else {
        item.status = "skipped";
        addNote(item, "skip", note || "Operator skipped the CSV.");
        stdout.write(`○ SKIP ${item.fileName}\n\n`);
      }

      await saveProcessingPlan(input.planPath, input.plan);
    }
  } finally {
    readline.close();
  }

  stdout.write(formatPlan(input.plan));
}
