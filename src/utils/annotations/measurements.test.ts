import { UNITS, formatMeasurement, randomValue } from "./measurements";

describe("randomValue", () => {
  it("stays inside the unit's range at both ends of the random source", () => {
    expect(randomValue("cm", () => 0)).toBe(1);
    expect(randomValue("cm", () => 0.999999)).toBe(100);
    expect(randomValue("m", () => 0)).toBe(0.1);
  });
  it("rounds to one decimal", () => {
    for (const unit of UNITS) {
      const v = randomValue(unit, () => 0.123456);
      expect(Math.round(v * 10) / 10).toBe(v);
    }
  });
});

describe("formatMeasurement", () => {
  it("joins value and unit", () => {
    expect(formatMeasurement(12.5, "cm")).toBe("12.5 cm");
  });
});
