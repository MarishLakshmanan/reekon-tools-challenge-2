import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How far the on-screen keyboard rises above the bottom safe-area inset, 0 while it is hidden.
 * Pad a screen by this, and keep the inset on its bottom bar, to sit the bar just above the keyboard.
 * Android reports the height without the navigation bar inset; iOS reports it with the home indicator inset.
 */
export function useKeyboardHeight(): number {
  const { bottom } = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return Platform.OS === "ios" ? Math.max(height - bottom, 0) : height;
}
