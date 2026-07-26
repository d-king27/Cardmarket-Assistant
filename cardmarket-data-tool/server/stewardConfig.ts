import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const STEWARD_PROMPT_VERSION = "phase2-v1";
export const STEWARD_PROVIDER_EFFORT = "medium";
export const STEWARD_MAX_TOKENS = 1800;
export const STEWARD_PROVIDER_TIMEOUT_MS = 30000;
export const STEWARD_PROMPT_CACHE_ENABLED = true;
export const STEWARD_PROMPT_CACHE_TTL = "5m";

export interface StewardProviderConfig {
  apiKey: string;
  model: string;
}

export function loadProjectEnv(cwd = process.cwd()): void {
  const envPath = resolve(cwd, ".env");
  if (!existsSync(envPath)) return;

  const envText = readFileSync(envPath, "utf8");
  envText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^"|"$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

export function getStewardProviderConfig(): StewardProviderConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey) {
    throw new ConfigError("Missing ANTHROPIC_API_KEY.");
  }
  if (!model) {
    throw new ConfigError("Missing ANTHROPIC_MODEL.");
  }
  return { apiKey, model };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
