import path from "node:path";

import type { CliArguments } from "./cli.js";

export interface AppConfig {
  batchPath: string;
  cardmarketUrl: string;
  extensionPath: string;
  profilePath: string;
  requestedSet?: string;
  headed: boolean;
  dryRun: true;
  reportsPath: string;
}

const CARDMARKET_DOMAIN = "cardmarket.com";

function requireValue(
  value: string | undefined,
  optionName: string,
): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required option: --${optionName}`);
  }

  return value;
}

function validateCardmarketUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("--url must be a valid URL");
  }

  const isCardmarketHost =
    parsed.hostname === CARDMARKET_DOMAIN ||
    parsed.hostname.endsWith(`.${CARDMARKET_DOMAIN}`);

  if (parsed.protocol !== "https:" || !isCardmarketHost) {
    throw new Error(
      "--url must be an HTTPS URL on cardmarket.com or one of its subdomains",
    );
  }

  return parsed.toString();
}

export function createConfig(
  cli: CliArguments,
  cwd: string = process.cwd(),
): AppConfig {
  if (!cli.dryRun) {
    throw new Error(
      "Only the import-preview dry run is currently supported; pass --dry-run",
    );
  }

  return {
    batchPath: path.resolve(cwd, requireValue(cli.batch, "batch")),
    cardmarketUrl: validateCardmarketUrl(requireValue(cli.url, "url")),
    extensionPath: path.resolve(
      cwd,
      requireValue(cli.extension, "extension"),
    ),
    profilePath: path.resolve(cwd, requireValue(cli.profile, "profile")),
    ...(cli.set === undefined ? {} : { requestedSet: cli.set }),
    headed: cli.headed,
    dryRun: true,
    reportsPath: path.resolve(cwd, "reports"),
  };
}
