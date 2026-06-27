// components/ui/Skeleton.tsx — animated opacity loop (design contract rule: loading = skeletons).

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

export function Skeleton({
  width,
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { t } = useTheme();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width ?? "100%", height, borderRadius: radius, backgroundColor: t.line, opacity: anim },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
});
