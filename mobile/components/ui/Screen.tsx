// components/ui/Screen.tsx — safe-area screen wrapper with optional pull-to-refresh.

import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: object;
}) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: t.bg, paddingTop: insets.top }]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.bg }]}
      contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: 24 }, contentStyle]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
