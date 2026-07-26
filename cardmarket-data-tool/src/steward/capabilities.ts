import type { StewardOperation, StewardPlan } from "./models";

export const EXECUTABLE_STEWARD_OPERATION_TYPES = [
  "split_collection",
] as const satisfies readonly StewardOperation["type"][];

export type ExecutableStewardOperationType =
  (typeof EXECUTABLE_STEWARD_OPERATION_TYPES)[number];

export function isExecutableStewardOperation(
  operationType: StewardOperation["type"],
): operationType is ExecutableStewardOperationType {
  return EXECUTABLE_STEWARD_OPERATION_TYPES.includes(
    operationType as ExecutableStewardOperationType,
  );
}

export function assertStewardPlanIsExecutable(plan: StewardPlan): void {
  const unsupported = plan.operations
    .map((operation) => operation.type)
    .filter((operationType) => !isExecutableStewardOperation(operationType));

  if (unsupported.length > 0) {
    throw new Error(
      `Steward plan contains operations that are not executable: ${[
        ...new Set(unsupported),
      ].join(", ")}`,
    );
  }
}
