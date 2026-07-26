import { ZodError } from "zod";
import type { QueuePublishRequest } from "../src/cardmarket/queueModels";
import {
  getQueueJob,
  listQueueJobs,
  publishQueueJob,
  QueueJobError,
} from "./cardmarketJobStore";

export async function handleCardmarketJobRequest(input: {
  method: string;
  pathname: string;
  body?: unknown;
}): Promise<{ status: number; body: unknown }> {
  try {
    if (input.method === "POST" && input.pathname === "/api/cardmarket/jobs") {
      const published = await publishQueueJob(input.body as QueuePublishRequest);
      return {
        status: 201,
        body: {
          job: published.manifest,
          directory: published.directory,
        },
      };
    }

    if (input.method === "GET" && input.pathname === "/api/cardmarket/jobs") {
      return {
        status: 200,
        body: {
          jobs: await listQueueJobs(),
        },
      };
    }

    const match = input.pathname.match(/^\/api\/cardmarket\/jobs\/([^/]+)$/);
    if (input.method === "GET" && match) {
      const job = await getQueueJob(decodeURIComponent(match[1]));
      if (!job) return { status: 404, body: { message: "Queue job not found." } };
      return {
        status: 200,
        body: {
          job: job.manifest,
          directory: job.directory,
        },
      };
    }

    return { status: 404, body: { message: "Not found." } };
  } catch (error) {
    if (error instanceof QueueJobError) {
      return { status: error.status, body: { message: error.message } };
    }
    if (error instanceof ZodError) {
      return {
        status: 400,
        body: {
          message: "Invalid Cardmarket queue request.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      };
    }
    console.error("Cardmarket queue request failed", error);
    return { status: 500, body: { message: "Cardmarket queue operation failed." } };
  }
}
