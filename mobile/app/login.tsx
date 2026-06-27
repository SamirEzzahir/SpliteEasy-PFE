// app/login.tsx — login screen (ported from app/login/page.tsx).
// Navigation after success is handled by the root AuthGuard.

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { RADIUS, useTheme } from "@/lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.logo, { backgroundColor: t.primary }]}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={[styles.title, { color: t.ink }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: t.ink3 }]}>Sign in to your SplitEasy account</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: t.ink2 }]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your username"
            placeholderTextColor={t.ink4}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.ink }]}
          />

          <Text style={[styles.label, { color: t.ink2 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={t.ink4}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.ink }]}
            onSubmitEditing={onSubmit}
          />

          {error ? <Text style={[styles.error, { color: t.rose }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: t.primary, opacity: busy ? 0.7 : 1 }]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign in</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={{ color: t.ink3 }}>Don&apos;t have an account? </Text>
            <Link href="/signup" replace>
              <Text style={{ color: t.primary, fontWeight: "700" }}>Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  logoText: { color: "#fff", fontSize: 32, fontWeight: "900" },
  title: { fontSize: 26, fontWeight: "900" },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 28 },
  form: { width: "100%" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { marginTop: 12, fontSize: 14, fontWeight: "600" },
  btn: { marginTop: 24, borderRadius: RADIUS, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
});
