// app/_layout.tsx — root layout: providers + auth guard + global chrome.
//
// Replaces the web app/layout.tsx (ConditionalShell). Provider order mirrors
// the web: Theme → Auth → App (global store). The AuthGuard redirects between
// the auth screens and the (tabs) area based on session state.

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { AppProvider } from "@/lib/store";
import { WSProvider } from "@/lib/ws-context";
import { ThemeProvider, useTheme } from "@/lib/theme";
import Toast from "@/components/ui/Toast";

function RootNav() {
  const { user, loading } = useAuth();
  const { t, isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "login" || segments[0] === "signup";
    if (!user && !inAuth) {
      router.replace("/login");
    } else if (user && inAuth) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="groups/[id]" options={{ presentation: "card" }} />
      </Stack>
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <WSProvider>
            <AppProvider>
              <RootNav />
            </AppProvider>
          </WSProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
