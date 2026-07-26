import { parseArgs } from "node:util";

export type Command =
  | "jobs"
  | "plan"
  | "stage"
  | "queue"
  | "status"
  | "demo";

export interface CliArguments {
  command?: Command;
  inputDir?: string;
  runtimeDir?: string;
  jobId?: string;
  batchId?: string;
  planPath?: string;
  cdpEndpoint?: string;
  retryFailed: boolean;
  help: boolean;
}

const COMMANDS = new Set<Command>([
  "jobs",
  "plan",
  "stage",
  "queue",
  "status",
  "demo",
]);

export function parseCliArguments(argv: string[]): CliArguments {
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      "input-dir": { type: "string" },
      "runtime-dir": { type: "string" },
      job: { type: "string" },
      batch: { type: "string" },
      plan: { type: "string" },
      cdp: { type: "string" },
      "retry-failed": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const commandValue = positionals[0];

  if (positionals.length > 1) {
    throw new Error(`Unexpected positional arguments: ${positionals.slice(1).join(" ")}`);
  }

  if (
    commandValue !== undefined &&
    !COMMANDS.has(commandValue as Command)
  ) {
    throw new Error(`Unknown command: ${commandValue}`);
  }

  return {
    ...(commandValue === undefined ? {} : { command: commandValue as Command }),
    ...(values["input-dir"] === undefined
      ? {}
      : { inputDir: values["input-dir"] }),
    ...(values["runtime-dir"] === undefined
      ? {}
      : { runtimeDir: values["runtime-dir"] }),
    ...(values.job === undefined ? {} : { jobId: values.job }),
    ...(values.batch === undefined ? {} : { batchId: values.batch }),
    ...(values.plan === undefined ? {} : { planPath: values.plan }),
    ...(values.cdp === undefined ? {} : { cdpEndpoint: values.cdp }),
    retryFailed: values["retry-failed"] ?? false,
    help: values.help ?? false,
  };
}

export function getHelpText(): string {
  return `Cardmarket CSV Queue Companion

Usage:
  npm run jobs -- [--runtime-dir <directory>] [--job <job-id>]
  npm run plan -- [--runtime-dir <directory>] [--job <job-id>] [--plan <path>]
  npm run plan -- --input-dir <legacy-directory> [--plan <path>]
  npm run stage -- [--plan <path>] [--job <job-id>] [--batch <batch-id>] [--cdp <endpoint>]
  npm run queue -- [--plan <path>] [--retry-failed]
  npm run status -- [--plan <path>]
  npm run demo -- [--plan <path>] [--cdp <endpoint>]

Commands:
  jobs    Validate and list jobs published by the data tool
  plan    Create or refresh a processing plan from validated queue jobs
  stage   Attach to Chrome and stage one validated batch in the extension preview
  queue   Walk pending plan items with manual pass/fail/skip checkpoints
  status  Print the current processing plan without changing it
  demo    Compatibility alias for stage

Options:
  --runtime-dir <path>  Shared runtime directory (default: ../.runtime)
  --job <job-id>        Use one published queue job
  --batch <batch-id>    Select one batch from the processing plan
  --input-dir <path>    Scan a legacy standalone CSV directory instead
  --plan <path>       Processing-plan JSON (default: reports/processing-plan.json)
  --cdp <endpoint>    Chrome debugging endpoint (default: http://127.0.0.1:9222)
  --retry-failed      Include previously failed items in the queue
  -h, --help          Show this help

The stage command only attaches to a Chrome instance you started for debugging.
Login, Cloudflare challenges, Fill Page, review, and final submission remain manual.
`;
}
