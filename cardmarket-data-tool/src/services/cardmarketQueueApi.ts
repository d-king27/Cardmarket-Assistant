import { z } from "zod";
import {
  queueJobManifestSchema,
  queuePublishRequestSchema,
} from "../cardmarket/queueModels";
import type {
  QueueJobManifest,
  QueuePublishRequest,
} from "../cardmarket/queueModels";

const publishedJobSchema = z
  .object({
    job: queueJobManifestSchema,
    directory: z.string(),
  })
  .strict();

const jobListSchema = z
  .object({
    jobs: z.array(queueJobManifestSchema),
  })
  .strict();

export interface PublishedQueueJob {
  job: QueueJobManifest;
  directory: string;
}

export async function publishCardmarketQueue(request: QueuePublishRequest): Promise<PublishedQueueJob> {
  const response = await fetch("/api/cardmarket/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queuePublishRequestSchema.parse(request)),
  }).catch(() => {
    throw new Error("The local Cardmarket Assistant server is not responding.");
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "Could not publish the Cardmarket queue."));
  return publishedJobSchema.parse(body);
}

export async function listCardmarketQueues(): Promise<QueueJobManifest[]> {
  const response = await fetch("/api/cardmarket/jobs").catch(() => {
    throw new Error("The local Cardmarket Assistant server is not responding.");
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "Could not load Cardmarket queue jobs."));
  return jobListSchema.parse(body).jobs;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("The local Cardmarket Assistant server returned an unreadable response.");
  }
}

function errorMessage(body: unknown, fallback: string): string {
  return typeof body === "object" && body !== null && "message" in body
    ? String((body as { message: unknown }).message)
    : fallback;
}
