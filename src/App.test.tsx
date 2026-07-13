import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { db } from "./data/database";

const csv = [
  "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added",
  '"Daredevil, Fearless Fighter",MSC,Marvel Super Heroes Commander,685,normal,rare,1,113902,a5cf63bd-66db-48b4-87b9-0d0e923e1e42,3.49,false,false,near_mint,en,GBP,2026-07-11T12:09:43.741Z',
].join("\n");

describe("ManaBox CSV Manager", () => {
  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("imports a CSV, displays the record, edits quantity, and persists the update", async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File([csv], "myList.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("CSV file"), file);
    await user.click(screen.getByRole("button", { name: "Import CSV" }));

    expect(await screen.findByText("Daredevil, Fearless Fighter")).toBeInTheDocument();
    expect(await screen.findByText("Main collection")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Daredevil, Fearless Fighter" }));
    const panel = screen.getByLabelText("Edit card");
    const quantity = within(panel).getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "3");
    await user.click(within(panel).getByRole("button", { name: "Save" }));

    expect(await within(panel).findByText("Saved")).toBeInTheDocument();
    await waitFor(async () => {
      const stored = await db.cards.toArray();
      expect(stored[0].quantity).toBe(3);
    });
  });
});
