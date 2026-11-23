import { type ComponentRef, useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "@/api/client";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useSession } from "@/hooks/useSession";
import { colors, radius, shadow, typography } from "@/utils/theme";

export function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const root = useRef<ComponentRef<typeof View>>(null);
  const [top, setTop] = useState(0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(signInError(e));
      setBusy(false);
    }
  }

  return (
    // Android is edge-to-edge, so the window doesn't resize for the keyboard; pad on both platforms.
    // The offset is where this screen starts (below the header), so the padding covers the whole keyboard.
    <View ref={root} style={styles.fill} onLayout={() => root.current?.measureInWindow((_x, y) => setTop(y))}>
      <KeyboardAvoidingView style={styles.fill} behavior="padding" keyboardVerticalOffset={top}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Icon name="measure" size={36} color={colors.white} />
          </View>
          <Text style={typography.title}>Reekon</Text>
          <Text style={styles.subtitle}>Sign in to your organization</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[styles.input, focus === "email" && styles.inputFocus]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocus("email")}
            onBlur={() => setFocus(null)}
            placeholder="you@company.com"
            placeholderTextColor={colors.tertiaryLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={[styles.input, focus === "password" && styles.inputFocus]}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocus("password")}
            onBlur={() => setFocus(null)}
            placeholder="Password"
            placeholderTextColor={colors.tertiaryLabel}
            secureTextEntry
            textContentType="password"
            onSubmitEditing={submit}
          />
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
          <Button label="Sign in" onPress={submit} busy={busy} disabled={!email || !password} style={styles.submit} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 },
  hero: { alignItems: "center", gap: 8 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.secondaryLabel },
  form: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 8, ...shadow },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.secondaryLabel, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.label,
  },
  inputFocus: { borderColor: colors.tint, backgroundColor: colors.card },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 10, marginTop: 4 },
  error: { color: colors.danger, fontWeight: "500" },
  submit: { marginTop: 12 },
});

function signInError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Could not reach the server.";
  return e.status === 401 ? "Wrong email or password." : "Sign-in failed. Try again.";
}
