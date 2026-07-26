import { describe, expect, it } from "vitest";
import { exportInventoryToCsv, validateRoundTrip } from "./csvExporter";
import { parseManaBoxCsv } from "./csvParser";

const validCsv = [
  "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added",
  '"Daredevil, Fearless Fighter",MSC,Marvel Super Heroes Commander,685,normal,rare,1,113902,a5cf63bd-66db-48b4-87b9-0d0e923e1e42,3.49,false,false,near_mint,en,GBP,2026-07-11T12:09:43.741Z',
].join("\n");

describe("parseManaBoxCsv", () => {
  it("parses a valid ManaBox row", () => {
    const result = parseManaBoxCsv(validCsv);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      name: "Daredevil, Fearless Fighter",
      setCode: "MSC",
      collectorNumber: "685",
      quantity: 1,
      purchasePrice: 3.49,
      misprint: false,
      altered: false,
      purchasePriceCurrency: "GBP",
    });
  });

  it("preserves commas inside quoted card names", () => {
    const result = parseManaBoxCsv(validCsv);

    expect(result.cards[0].name).toBe("Daredevil, Fearless Fighter");
  });

  it("treats an empty purchase price as null", () => {
    const csv = validCsv.replace(",3.49,", ",,");
    const result = parseManaBoxCsv(csv);

    expect(result.cards[0].purchasePrice).toBeNull();
  });

  it("imports optional target price and notes fields for queue preparation", () => {
    const [headers, row] = validCsv.split("\n");
    const csv = [
      `${headers},Target price,Notes`,
      `${row},4.75,"Cardmarket listing price"`,
    ].join("\n");
    const result = parseManaBoxCsv(csv);

    expect(result.cards[0].targetPrice).toBe(4.75);
    expect(result.cards[0].notes).toBe("Cardmarket listing price");
    expect(result.unknownHeaders).not.toContain("Target price");
  });

  it("rejects an invalid quantity while retaining the row", () => {
    const csv = validCsv.replace(",1,113902,", ",x,113902,");
    const result = parseManaBoxCsv(csv);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].validationIssues.some((issue) => issue.field === "quantity")).toBe(true);
  });

  it("reports malformed boolean fields predictably", () => {
    const csv = validCsv.replace(",false,false,", ",maybe,false,");
    const result = parseManaBoxCsv(csv);

    expect(result.cards[0].misprint).toBe(false);
    expect(result.cards[0].validationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "boolean_invalid" })]),
    );
  });

  it("reports missing required headers", () => {
    const csv = validCsv.replace("Quantity,", "");
    const result = parseManaBoxCsv(csv);

    expect(result.missingRequiredHeaders).toContain("Quantity");
  });

  it("preserves collector numbers as strings", () => {
    const csv = validCsv.replace(",685,", ",12a,");
    const result = parseManaBoxCsv(csv);

    expect(result.cards[0].collectorNumber).toBe("12a");
  });

  it("detects duplicate rows", () => {
    const result = parseManaBoxCsv([validCsv, validCsv.split("\n")[1]].join("\n"));

    expect(result.cards).toHaveLength(2);
    expect(result.cards.every((card) => card.validationIssues.some((issue) => issue.code === "potential_duplicate"))).toBe(true);
  });
});

describe("exportInventoryToCsv", () => {
  it("exports and reimports without losing core fields", () => {
    const parsed = parseManaBoxCsv(validCsv);
    const exported = exportInventoryToCsv(parsed.cards);
    const roundTrip = validateRoundTrip(exported);

    expect(roundTrip.cards[0]).toMatchObject({
      name: "Daredevil, Fearless Fighter",
      setCode: "MSC",
      collectorNumber: "685",
      quantity: 1,
    });
  });

  it("escapes CSV values containing commas and quotation marks", () => {
    const parsed = parseManaBoxCsv(validCsv);
    const csv = exportInventoryToCsv([
      {
        ...parsed.cards[0],
        name: 'Card, with "quotes"',
        notes: 'Needs review, "soon"',
      },
    ]);

    expect(csv).toContain('"Card, with ""quotes"""');
    expect(csv).toContain('"Needs review, ""soon"""');
  });
});
