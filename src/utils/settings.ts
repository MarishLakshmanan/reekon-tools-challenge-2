type LineWidth = "thin" | "medium" | "thick";
type TextSize = "small" | "medium" | "large";

/** Personal drawing preferences. Kept on the device only. */
export type Settings = {
  lineColor: string;
  lineWidth: LineWidth;
  textColor: string;
  textSize: TextSize;
};

export const DEFAULT_SETTINGS: Settings = {
  lineColor: "#ff3b30",
  lineWidth: "medium",
  textColor: "#ffd60a",
  textSize: "medium",
};

export const SWATCHES = ["#ff3b30", "#ff9f0a", "#ffd60a", "#34c759", "#0a84ff", "#af52de", "#ffffff", "#000000"];

export const WIDTH_FACTOR: Record<LineWidth, number> = { thin: 0.5, medium: 1, thick: 2 };
export const SIZE_FACTOR: Record<TextSize, number> = { small: 0.75, medium: 1, large: 1.5 };

/** True when `v` is one of `record`'s keys. */
const isKeyOf = <T extends string>(record: Record<T, unknown>, v: unknown): v is T => typeof v === "string" && v in record;

/** Reads saved settings; any missing or invalid field falls back to its default. */
export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // unreadable file: use defaults
  }
  const color = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  return {
    lineColor: color(data.lineColor, DEFAULT_SETTINGS.lineColor),
    lineWidth: isKeyOf(WIDTH_FACTOR, data.lineWidth) ? data.lineWidth : DEFAULT_SETTINGS.lineWidth,
    textColor: color(data.textColor, DEFAULT_SETTINGS.textColor),
    textSize: isKeyOf(SIZE_FACTOR, data.textSize) ? data.textSize : DEFAULT_SETTINGS.textSize,
  };
}
