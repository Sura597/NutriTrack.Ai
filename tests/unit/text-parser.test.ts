import { describe, it, expect } from "vitest";
import { nameVariants, normalizeUnitToken, parseMealText } from "@/lib/analysis/text-parser";

const p = (t: string) => parseMealText(t).map(({ quantity, unit, name, quantityAssumed }) => ({ quantity, unit, name, quantityAssumed }));

describe("parseMealText", () => {
  it("parses the spec example: multiple items, counts, household units, 'and'", () => {
    expect(p("2 rotis, 1 bowl dal, 1 cup rice and mixed vegetables")).toEqual([
      { quantity: 2, unit: null, name: "rotis", quantityAssumed: false },
      { quantity: 1, unit: "bowl", name: "dal", quantityAssumed: false },
      { quantity: 1, unit: "cup", name: "rice", quantityAssumed: false },
      { quantity: 1, unit: null, name: "mixed vegetables", quantityAssumed: true },
    ]);
  });
  it("handles weights glued to numbers and 'of'", () => {
    expect(p("200g paneer, 250 ml of milk")).toEqual([
      { quantity: 200, unit: "g", name: "paneer", quantityAssumed: false },
      { quantity: 250, unit: "ml", name: "milk", quantityAssumed: false },
    ]);
  });
  it("understands number words, fractions and mixed numbers", () => {
    expect(p("two eggs")[0]).toMatchObject({ quantity: 2, name: "eggs" });
    expect(p("half cup curd")[0]).toMatchObject({ quantity: 0.5, unit: "cup", name: "curd" });
    expect(p("1/2 cup rice")[0]).toMatchObject({ quantity: 0.5, unit: "cup" });
    expect(p("1 1/2 cups rice")[0]).toMatchObject({ quantity: 1.5, unit: "cup", name: "rice" });
    expect(p("a glass of milk")[0]).toMatchObject({ quantity: 1, unit: "glass", name: "milk", quantityAssumed: false });
    expect(p("a couple of idlis")[0]).toMatchObject({ quantity: 2, name: "idlis" });
  });
  it("supports trailing quantities", () => {
    expect(p("rice 1 cup")[0]).toMatchObject({ quantity: 1, unit: "cup", name: "rice" });
    expect(p("milk 200 ml")[0]).toMatchObject({ quantity: 200, unit: "ml", name: "milk" });
  });
  it("strips filler like 'I had' and 'for lunch'", () => {
    expect(p("I had 2 rotis and dal")).toEqual([
      { quantity: 2, unit: null, name: "rotis", quantityAssumed: false },
      { quantity: 1, unit: null, name: "dal", quantityAssumed: true },
    ]);
    expect(p("for lunch: 1 plate biryani")[0]).toMatchObject({ unit: "plate", name: "biryani" });
  });
  it("marks a missing quantity as assumed instead of inventing one silently", () => {
    expect(p("poha")[0]).toMatchObject({ quantity: 1, unit: null, quantityAssumed: true });
  });
  it("splits on newlines, semicolons, plus and ampersand", () => {
    expect(p("roti\ndal; rice + curd & egg").map((s) => s.name)).toEqual(["roti", "dal", "rice", "curd", "egg"]);
  });
  it("ignores empty input and punctuation-only segments", () => {
    expect(p("")).toEqual([]);
    expect(p(" , , ")).toEqual([]);
  });
  it("never produces zero or negative quantities", () => {
    expect(parseMealText("0 rotis")[0].quantity).toBe(1);
    expect(parseMealText("0 rotis")[0].quantity).toBeGreaterThan(0);
  });
  it("drops bracketed notes", () => {
    expect(p("1 bowl dal (tadka)")[0]).toMatchObject({ unit: "bowl", name: "dal" });
  });
});

describe("unit and name helpers", () => {
  it("normalises unit aliases", () => {
    expect(normalizeUnitToken("gms")).toBe("g");
    expect(normalizeUnitToken("Katori")).toBe("katori");
    expect(normalizeUnitToken("pcs")).toBe("piece");
    expect(normalizeUnitToken("banana")).toBeNull();
  });
  it("offers singular variants for plural food names", () => {
    expect(nameVariants("rotis")).toEqual(["rotis", "roti"]);
    expect(nameVariants("eggs")).toEqual(["eggs", "egg"]);
    expect(nameVariants("parathas")).toContain("paratha");
    expect(nameVariants("tomatoes")).toContain("tomato");
    expect(nameVariants("dal")).toEqual(["dal"]);
    expect(nameVariants("boiled eggs")).toContain("boiled egg");
  });
});
