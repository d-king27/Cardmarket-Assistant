import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { handleCardmarketJobRequest } from "./cardmarketJobRoute";
import { loadProjectEnv } from "./stewardConfig";
import { handleStewardPlan } from "./stewardRoute";

loadProjectEnv();

const port = Number(process.env.STEWARD_SERVER_PORT ?? 5174);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

  if (request.method === "POST" && pathname === "/api/steward/plan") {
    try {
      const body = await readJsonBody(request, 128_000);
      const result = await handleStewardPlan(body);
      response.statusCode = result.status;
      response.end(JSON.stringify(result.body));
    } catch {
      response.statusCode = 400;
      response.end(JSON.stringify({ message: "Invalid JSON request." }));
    }
    return;
  }

  if (pathname === "/api/cardmarket/jobs" || pathname.startsWith("/api/cardmarket/jobs/")) {
    try {
      const body = request.method === "POST" ? await readJsonBody(request, 10_000_000) : undefined;
      const result = await handleCardmarketJobRequest({
        method: request.method ?? "GET",
        pathname,
        body,
      });
      response.statusCode = result.status;
      response.end(JSON.stringify(result.body));
    } catch (error) {
      response.statusCode = error instanceof RequestBodyError ? error.status : 400;
      response.end(JSON.stringify({ message: error instanceof Error ? error.message : "Invalid request." }));
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/health") {
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ message: "Not found." }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Cardmarket Assistant server listening on http://127.0.0.1:${port}`);
});

function readJsonBody(
  request: IncomingMessage,
  maximumBytes: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    request.on("data", (chunk) => {
      if (settled) return;
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maximumBytes) {
        settled = true;
        reject(new RequestBodyError("Request payload is too large.", 413));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (settled) return;
      try {
        settled = true;
        resolve(body ? JSON.parse(body) : {});
      } catch (caught) {
        settled = true;
        reject(new RequestBodyError("Invalid JSON request.", 400, { cause: caught }));
      }
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RequestBodyError";
  }
}
