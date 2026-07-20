import { parseArgs } from "node:util";

export type Command = "plan" | "queue" | "status";

export interface CliArguments {
  command?: Command;
  inputDir?: string;
  planPath?: string;
  retryFailed: boolean;
  help: boolean;
}

const COMMANDS = new Set<Command>(["plan", "queue", "status"]);

export function parseCliArguments(argv: string[]): CliArguments {
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      "input-dir": { type: "string" },
      plan: { type: "string" },
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
    ...(values.plan === undefined ? {} : { planPath: values.plan }),
    retryFailed: values["retry-failed"] ?? false,
    help: values.help ?? false,
  };
}

export function getHelpText(): string {
  return `Cardmarket CSV Queue Companion

Usage:
  npm run plan -- [--input-dir <directory>] [--plan <path>]
  npm run queue -- [--plan <path>] [--retry-failed]
  npm run status -- [--plan <path>]

Commands:
  plan    Scan CSV files and create or refresh the processing plan
  queue   Walk pending plan items with manual pass/fail/skip checkpoints
  status  Print the current processing plan without changing it

Options:
  --input-dir <path>  CSV drop directory (default: inbox)
  --plan <path>       Processing-plan JSON (default: reports/processing-plan.json)
  --retry-failed      Include previously failed items in the queue
  -h, --help          Show this help

This workflow does not launch or control Chrome. Login, Cloudflare, Cardmarket
navigation, extension actions, Fill Page, and final submission remain manual.
`;
}
