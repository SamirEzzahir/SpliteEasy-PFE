// components/ui/PageHeader.tsx — unified page header (one .page-head equivalent).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { t } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.ink3 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  title: { fontSize: 26, fontWeight: "900" },
  subtitle: { fontSize: 14, marginTop: 2 },
});
