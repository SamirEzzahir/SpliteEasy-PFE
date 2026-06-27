// components/ui/Avatar.tsx — initials avatar + overlapping stack.
// Ported from the web Avatar/AvatarStack (gradient → solid color in RN).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Person } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  person,
  size = 40,
  ring,
}: {
  person: Pick<Person, "name" | "color" | "color2">;
  size?: number;
  ring?: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: person.color,
          borderWidth: ring ? 2 : 0,
          borderColor: ring,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(person.name)}</Text>
    </View>
  );
}

export function AvatarStack({
  people,
  size = 32,
  max = 4,
  ring = "#ffffff",
}: {
  people: Pick<Person, "name" | "color" | "color2">[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.row}>
      {shown.map((p, i) => (
        <View key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
          <Avatar person={p} size={size} ring={ring} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.more,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.32, borderColor: ring },
          ]}
        >
          <Text style={[styles.moreText, { fontSize: size * 0.34 }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center" },
  more: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#94a3b8",
    borderWidth: 2,
  },
  moreText: { color: "#fff", fontWeight: "800" },
});
