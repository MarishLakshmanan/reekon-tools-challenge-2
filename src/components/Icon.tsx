import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

/** Logical icon names mapped to an SF Symbol (iOS) and a Material Symbol (Android and web). */
const ICONS = {
  add: { ios: "plus", android: "add" },
  camera: { ios: "camera.fill", android: "photo_camera" },
  photos: { ios: "photo.on.rectangle", android: "photo_library" },
  folder: { ios: "folder.fill", android: "folder" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  settings: { ios: "gearshape", android: "settings" },
  signOut: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  trash: { ios: "trash", android: "delete" },
  check: { ios: "checkmark", android: "check" },
  undo: { ios: "arrow.uturn.backward", android: "undo" },
  select: { ios: "cursorarrow", android: "touch_app" },
  pen: { ios: "pencil.tip", android: "ink_pen" },
  measure: { ios: "ruler", android: "straighten" },
  text: { ios: "textformat", android: "text_fields" },
  sparkles: { ios: "sparkles", android: "auto_awesome" },
  send: { ios: "arrow.up.circle.fill", android: "send" },
  done: { ios: "checkmark.circle.fill", android: "check_circle" },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} />;
}
