// components/ui/Card.tsx — surface card matching the web .card (radius 14, border, subtle shadow).

import React from "react";
import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { RADIUS, useTheme } from "@/lib/theme";

export function Card({ style, children, ...rest }: ViewProps & { style?: ViewStyle | ViewStyle[] }) {
  const { t } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.line },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
});
