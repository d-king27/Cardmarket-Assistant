import type { SetBatch } from "./types.js";

export interface ExpansionOption {
  label: string;
  value: string;
}

export interface ExpansionReasoner {
  chooseOption(input: {
    setCode?: string;
    setName?: string;
    options: ExpansionOption[];
  }): Promise<string | undefined>;
}

export interface ResolvedExpansion extends ExpansionOption {
  method: "exact-name" | "exact-code" | "reasoner";
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function codeTokens(label: string): string[] {
  return label
    .split(/[\s()[\]{}:/_-]+/)
    .map(normalize)
    .filter((token) => token !== "");
}

export async function resolveExpansionOption(
  options: ExpansionOption[],
  set: SetBatch,
  reasoner?: ExpansionReasoner,
): Promise<ResolvedExpansion> {
  if (set.setName !== undefined) {
    const expectedName = normalize(set.setName);
    const exactNames = options.filter(
      (option) => normalize(option.label) === expectedName,
    );

    if (exactNames.length === 1) {
      return { ...exactNames[0]!, method: "exact-name" };
    }
  }

  if (set.setCode !== undefined) {
    const expectedCode = normalize(set.setCode);
    const exactCodes = options.filter((option) =>
      codeTokens(option.label).includes(expectedCode),
    );

    if (exactCodes.length === 1) {
      return { ...exactCodes[0]!, method: "exact-code" };
    }
  }

  if (reasoner !== undefined) {
    const selectedValue = await reasoner.chooseOption({
      ...(set.setCode === undefined ? {} : { setCode: set.setCode }),
      ...(set.setName === undefined ? {} : { setName: set.setName }),
      options,
    });
    const selected = options.find((option) => option.value === selectedValue);

    if (selected !== undefined) {
      return { ...selected, method: "reasoner" };
    }
  }

  throw new Error(
    `No unambiguous Cardmarket expansion option matched ${set.setName ?? "unknown set"}${set.setCode === undefined ? "" : ` [${set.setCode}]`}. Refusing to guess.`,
  );
}
