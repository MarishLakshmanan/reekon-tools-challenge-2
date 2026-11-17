import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from "react-native";

import { ApiError } from "@/api/client";
import { useSession } from "@/hooks/useSession";

export function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        textContentType="password"
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, (busy || !email || !password) && styles.disabled]} onPress={submit} disabled={busy || !email || !password}>
        {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 10, padding: 12, fontSize: 16 },
  error: { color: "#ff3b30" },
  button: { padding: 14, borderRadius: 10, backgroundColor: "#0a84ff", alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});

function signInError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Could not reach the server.";
  return e.status === 401 ? "Wrong email or password." : "Sign-in failed. Try again.";
}
