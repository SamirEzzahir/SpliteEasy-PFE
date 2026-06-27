// app/signup.tsx — registration screen (ported from app/signup/page.tsx).
// Registers then auto-logs-in; navigation handled by the root AuthGuard.

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
import { apiErrorMessage } from "@/lib/api/client";
import { RADIUS, useTheme } from "@/lib/theme";

export default function SignupScreen() {
  const { register } = useAuth();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError("Username, email and password are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
      });
    } catch (e) {
      setError(apiErrorMessage(e));
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.logo, { backgroundColor: t.primary }]}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={[styles.title, { color: t.ink }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: t.ink3 }]}>Start splitting expenses with friends</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: t.ink2 }]}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Samir Ali"
            placeholderTextColor={t.ink4}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.ink }]}
          />
          <Text style={[styles.label, { color: t.ink2 }]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="samir"
            placeholderTextColor={t.ink4}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.ink }]}
          />
          <Text style={[styles.label, { color: t.ink2 }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
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
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={{ color: t.ink3 }}>Already have an account? </Text>
            <Link href="/login" replace>
              <Text style={{ color: t.primary, fontWeight: "700" }}>Sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  title: { fontSize: 24, fontWeight: "900" },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 22 },
  form: { width: "100%" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { marginTop: 12, fontSize: 14, fontWeight: "600" },
  btn: { marginTop: 22, borderRadius: RADIUS, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
});
