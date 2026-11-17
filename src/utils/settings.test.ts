import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("returns defaults for a missing or unreadable file", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("42")).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps valid fields", () => {
    const saved = { lineColor: "#0a84ff", lineWidth: "thick", textColor: "#ffffff", textSize: "large" };
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
  });
  it("replaces only the invalid fields", () => {
    const out = parseSettings(JSON.stringify({ lineColor: "red", lineWidth: "thick", textSize: "huge" }));
    expect(out).toEqual({ ...DEFAULT_SETTINGS, lineWidth: "thick" });
  });
});
