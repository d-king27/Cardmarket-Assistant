import { parseArgs } from "node:util";

export interface CliArguments {
  batch?: string;
  url?: string;
  extension?: string;
  profile?: string;
  set?: string;
  headed: boolean;
  dryRun: boolean;
  help: boolean;
}

export function parseCliArguments(argv: string[]): CliArguments {
  const { values } = parseArgs({
    args: argv,
    options: {
      batch: { type: "string" },
      url: { type: "string" },
      extension: { type: "string" },
      profile: { type: "string" },
      set: { type: "string" },
      headed: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
    strict: true,
  });

  return {
    ...(values.batch === undefined ? {} : { batch: values.batch }),
    ...(values.url === undefined ? {} : { url: values.url }),
    ...(values.extension === undefined
      ? {}
      : { extension: values.extension }),
    ...(values.profile === undefined ? {} : { profile: values.profile }),
    ...(values.set === undefined ? {} : { set: values.set }),
    headed: values.headed ?? false,
    dryRun: values["dry-run"] ?? false,
    help: values.help ?? false,
  };
}

export function getHelpText(): string {
  return `Cardmarket Playwright Companion

Usage:
  npm run run:dry -- --batch <path> --url <url> --extension <path> --profile <path> [--set <code-or-name>] [--headed]

Options:
  --batch <path>      ManaBox CSV or versioned listing batch JSON file
  --url <url>         Cardmarket bulk-listing HTTPS URL
  --extension <path>  Unpacked Manifest V3 extension build directory
  --profile <path>    Persistent Chromium user-data directory
  --set <value>       Set code or name; required when the batch has multiple sets
  --headed            Show Chromium and wait until the user closes it
  --dry-run           Stage an extension import preview without filling the page
  -h, --help          Show this help
`;
}
