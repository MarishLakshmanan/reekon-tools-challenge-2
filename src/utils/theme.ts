import { Platform } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

/** Colours, radii and shared styles. Every screen takes its look from here. */
export const colors = {
  tint: "#0a84ff",
  /** Selection handles, the picked segment and unassigned measurements. */
  highlight: "#ff9f0a",
  tintSoft: "#e5f1ff",
  danger: "#ff3b30",
  dangerSoft: "#ffe9e7",
  warning: "#ff9500",
  warningSoft: "#fff4e0",
  label: "#111111",
  secondaryLabel: "#6b6b70",
  tertiaryLabel: "#8e8e93",
  background: "#f2f2f7",
  card: "#ffffff",
  separator: "#d1d1d6",
  fill: "#e5e5ea",
  white: "#ffffff",
} as const;

/** Widest the app gets on a large window (the web). */
export const MAX_CONTENT_WIDTH = 960;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const shadow: ViewStyle = Platform.select<ViewStyle>({
  android: { elevation: 2 },
  default: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
})!;

export const typography = {
  title: { fontSize: 28, fontWeight: "700", color: colors.label } satisfies TextStyle,
  headline: { fontSize: 17, fontWeight: "600", color: colors.label } satisfies TextStyle,
  caption: { fontSize: 12, color: colors.secondaryLabel } satisfies TextStyle,
  section: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.secondaryLabel,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  } satisfies TextStyle,
};
