import { Platform } from "react-native";

/** The web build only views and edits server copies: no local photos, settings or camera. */
export const isWeb = Platform.OS === "web";
