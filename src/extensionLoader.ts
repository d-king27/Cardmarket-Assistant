import { readFile, stat } from "node:fs/promises";
import path from "node:path";

interface ExtensionManifest {
  manifest_version?: unknown;
  name?: unknown;
  version?: unknown;
}

export interface ExtensionBuild {
  path: string;
  name: string;
  version: string;
}

export async function validateExtensionBuild(
  extensionPath: string,
): Promise<ExtensionBuild> {
  let extensionStats;

  try {
    extensionStats = await stat(extensionPath);
  } catch (error) {
    throw new Error(`Extension build does not exist: ${extensionPath}`, {
      cause: error,
    });
  }

  if (!extensionStats.isDirectory()) {
    throw new Error(`Extension build is not a directory: ${extensionPath}`);
  }

  const manifestPath = path.join(extensionPath, "manifest.json");
  let manifest: ExtensionManifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ExtensionManifest;
  } catch (error) {
    throw new Error(`Unable to read extension manifest: ${manifestPath}`, {
      cause: error,
    });
  }

  if (manifest.manifest_version !== 3) {
    throw new Error("The unpacked extension must use Manifest V3");
  }

  return {
    path: extensionPath,
    name: typeof manifest.name === "string" ? manifest.name : "Unnamed extension",
    version: typeof manifest.version === "string" ? manifest.version : "unknown",
  };
}
