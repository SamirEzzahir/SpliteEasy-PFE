// components/ui/EmptyState.tsx — icon + message + optional CTA (design contract rule 6).

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RADIUS, useTheme } from "@/lib/theme";

export function EmptyState({
  icon = "📭",
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon?: string;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const { t } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      {message ? <Text style={[styles.msg, { color: t.ink3 }]}>{message}</Text> : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity onPress={onCta} style={[styles.cta, { backgroundColor: t.primary }]}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 8 },
  icon: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  msg: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  cta: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 12, borderRadius: RADIUS },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
