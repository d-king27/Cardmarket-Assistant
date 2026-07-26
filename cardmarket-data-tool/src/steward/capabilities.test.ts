import { describe, expect, it } from "vitest";
import {
  assertStewardPlanIsExecutable,
  EXECUTABLE_STEWARD_OPERATION_TYPES,
} from "./capabilities";
import type { StewardPlan } from "./models";

function planWithOperation(
  operation: StewardPlan["operations"][number],
): StewardPlan {
  return {
    id: "test-plan",
    title: "Test plan",
    summary: "Test executable operation validation.",
    userRequest: "Test",
    operations: [operation],
    warnings: [],
    assumptions: [],
  };
}

describe("Steward executable capabilities", () => {
  it("advertises only operations implemented by the executor", () => {
    expect(EXECUTABLE_STEWARD_OPERATION_TYPES).toEqual(["split_collection"]);
  });

  it("rejects a validated but unimplemented operation before execution", () => {
    expect(() =>
      assertStewardPlanIsExecutable(
        planWithOperation({
          type: "remove_records",
          predicate: { type: "all" },
        }),
      ),
    ).toThrow("not executable: remove_records");
  });
});
