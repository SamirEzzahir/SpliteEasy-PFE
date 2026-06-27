// app/(tabs)/groups.tsx — group cards list. Ported from app/groups/page.tsx.

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/format";
import { personById } from "@/lib/data";
import { RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AvatarStack } from "@/components/ui/Avatar";

export default function GroupsScreen() {
  const { groups, loading, refetchSplitting } = useApp();
  const { t } = useTheme();
  const router = useRouter();

  return (
    <Screen onRefresh={refetchSplitting} refreshing={loading}>
      <PageHeader title="Groups" subtitle={`${groups.length} group${groups.length === 1 ? "" : "s"}`} />

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={92} radius={RADIUS} />)}
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No groups yet"
          message="Create a group to start splitting expenses with friends."
        />
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {groups.map((g) => {
            const members = g.memberIds.map((id) => personById(id));
            const positive = g.balance >= 0;
            return (
              <TouchableOpacity key={g.id} activeOpacity={0.85} onPress={() => router.push(`/groups/${g.id}`)}>
                <Card style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: g.soft }]}>
                      <Text style={{ fontSize: 22 }}>{iconFor(g.type)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{g.name}</Text>
                      <Text style={[styles.meta, { color: t.ink3 }]}>
                        {g.memberIds.length} members · {g.updated}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.total, { color: t.ink }]}>{fmt(g.total, g.currency)}</Text>
                      <Text style={[styles.balance, { color: g.balance === 0 ? t.ink4 : positive ? t.success : t.rose }]}>
                        {g.balance === 0 ? "settled" : `${positive ? "+" : "-"}${fmt(Math.abs(g.balance), g.currency)}`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <AvatarStack people={members} size={28} ring={t.surface} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function iconFor(type: string): string {
  switch (type) {
    case "trip": return "✈️";
    case "home": return "🏠";
    case "work": return "💼";
    default: return "🎉";
  }
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, marginTop: 2 },
  total: { fontSize: 16, fontWeight: "800" },
  balance: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "center" },
});
