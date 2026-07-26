import { createServer } from "node:http";
import { loadProjectEnv } from "./stewardConfig";
import { handleStewardPlan } from "./stewardRoute";

loadProjectEnv();

const port = Number(process.env.STEWARD_SERVER_PORT ?? 5174);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");

  if (request.method === "POST" && request.url === "/api/steward/plan") {
    try {
      const body = await readJsonBody(request);
      const result = await handleStewardPlan(body);
      response.statusCode = result.status;
      response.end(JSON.stringify(result.body));
    } catch {
      response.statusCode = 400;
      response.end(JSON.stringify({ message: "Invalid JSON request." }));
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ message: "Not found." }));
});

server.listen(port, () => {
  console.log(`CSV Steward server listening on http://localhost:${port}`);
});

function readJsonBody(request: Parameters<typeof createServer>[0] extends (req: infer Req, res: never) => unknown ? Req : never): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
      if (body.length > 128_000) {
        reject(new Error("Payload too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (caught) {
        reject(caught);
      }
    });
    request.on("error", reject);
  });
}
