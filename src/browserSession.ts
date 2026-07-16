import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import type { AppConfig } from "./config.js";

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

export async function launchBrowserSession(
  config: AppConfig,
): Promise<BrowserSession> {
  await mkdir(config.profilePath, { recursive: true });

  const context = await chromium.launchPersistentContext(config.profilePath, {
    channel: "chromium",
    headless: !config.headed,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
    ],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export async function waitForBrowserToClose(
  context: BrowserContext,
): Promise<void> {
  const browser = context.browser();

  if (browser === null || !browser.isConnected()) {
    return;
  }

  await new Promise<void>((resolve) => {
    browser.once("disconnected", () => resolve());
  });
}
