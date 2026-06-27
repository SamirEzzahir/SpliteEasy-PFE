// components/ui/Toast.tsx — global toast, driven by store's toast state.
// Replaces the web react-toastify usage. Rendered once in the root layout.

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type ToastType } from "@/lib/store";
import { useTheme } from "@/lib/theme";

const ICON: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export default function Toast() {
  const { toast } = useApp();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: toast ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [toast, anim]);

  if (!toast) return null;

  const color =
    toast.type === "success" ? t.success
    : toast.type === "error" ? t.rose
    : toast.type === "warning" ? t.warn
    : t.primary;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + 90,
          backgroundColor: t.surface,
          borderColor: t.line,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.icon, { color }]}>{ICON[toast.type]}</Text>
      <Text style={[styles.msg, { color: t.ink }]} numberOfLines={2}>
        {toast.msg}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: { fontSize: 16, fontWeight: "900" },
  msg: { flex: 1, fontSize: 14, fontWeight: "600" },
});
