import { stewardResponseSchema } from "../steward/schemas";
import type { StewardPlanRequest, StewardResponse } from "../steward/models";

export async function requestStewardPlan(payload: StewardPlanRequest): Promise<StewardResponse> {
  let response: Response;
  try {
    response = await fetch("/api/steward/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("CSV Steward server is not responding. Restart the dev server and try again.");
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new Error("CSV Steward returned an unreadable response. Restart the dev server and try again.");
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "CSV Steward could not create a plan.";
    throw new Error(message);
  }

  const parsed = stewardResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("CSV Steward returned an invalid plan. Restart the dev server and try again.");
  }

  return parsed.data as StewardResponse;
}
