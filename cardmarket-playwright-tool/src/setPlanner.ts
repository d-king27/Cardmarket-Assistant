import type {
  ListingBatchMessage,
  ListingRecord,
  SetBatch,
} from "./types.js";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function setKey(record: ListingRecord): string {
  const code = record.setCode?.trim() ?? "";
  const name = record.setName?.trim() ?? "";

  if (code === "" && name === "") {
    throw new Error(
      `Record ${record.id} has neither setCode nor setName and cannot be routed to an expansion`,
    );
  }

  return `${normalize(code)}|${normalize(name)}`;
}

export function groupBatchBySet(batch: ListingBatchMessage): SetBatch[] {
  const groups = new Map<string, SetBatch>();

  for (const record of batch.records) {
    const key = setKey(record);
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, {
        ...(record.setCode === undefined ? {} : { setCode: record.setCode }),
        ...(record.setName === undefined ? {} : { setName: record.setName }),
        records: [record],
      });
    } else {
      existing.records.push(record);
    }
  }

  return [...groups.values()].sort((left, right) =>
    (left.setName ?? left.setCode ?? "").localeCompare(
      right.setName ?? right.setCode ?? "",
    ),
  );
}

function matchesRequestedSet(group: SetBatch, requestedSet: string): boolean {
  const requested = normalize(requestedSet);
  return (
    (group.setCode !== undefined && normalize(group.setCode) === requested) ||
    (group.setName !== undefined && normalize(group.setName) === requested)
  );
}

export function selectSetBatch(
  batch: ListingBatchMessage,
  requestedSet?: string,
): SetBatch {
  const groups = groupBatchBySet(batch);

  if (requestedSet !== undefined) {
    const matches = groups.filter((group) =>
      matchesRequestedSet(group, requestedSet),
    );

    if (matches.length !== 1) {
      throw new Error(
        `--set "${requestedSet}" did not identify exactly one CSV set. Available sets: ${formatAvailableSets(groups)}`,
      );
    }

    return matches[0]!;
  }

  if (groups.length !== 1) {
    throw new Error(
      `The batch contains ${groups.length} sets. Pass --set with one of: ${formatAvailableSets(groups)}`,
    );
  }

  return groups[0]!;
}

function formatAvailableSets(groups: SetBatch[]): string {
  return groups
    .map((group) => {
      const code = group.setCode === undefined ? "" : ` [${group.setCode}]`;
      return `${group.setName ?? "Unnamed set"}${code}`;
    })
    .join(", ");
}
