// app/(tabs)/expenses.tsx — full expense list with group filter.
// Ported from app/expenses/page.tsx (content-faithful; filters via pills).

import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/format";
import { personById, categoryById } from "@/lib/data";
import { PILL, RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ExpensesScreen() {
  const { expenses, groups, loading, refetchSplitting } = useApp();
  const { t } = useTheme();
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = groupFilter === "all" ? expenses : expenses.filter((e) => e.groupId === groupFilter);
    return [...list].sort((a, b) => (b._rawDate || "").localeCompare(a._rawDate || ""));
  }, [expenses, groupFilter]);

  const total = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  return (
    <Screen onRefresh={refetchSplitting} refreshing={loading}>
      <PageHeader title="Expenses" subtitle={`${filtered.length} items · ${fmt(total)}`} />

      {/* Group filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {[{ id: "all", name: "All" }, ...groups].map((g) => {
          const active = groupFilter === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGroupFilter(g.id)}
              style={[
                styles.pill,
                { borderColor: t.line, backgroundColor: active ? t.primary : t.surface },
              ]}
            >
              <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 13 }}>{g.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={62} radius={RADIUS} />)}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🧾" title="No expenses" message="Expenses you add will appear here." />
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
          {filtered.map((e) => {
            const cat = categoryById(e.categoryId);
            const payer = personById(e.paidBy);
            const group = groups.find((g) => g.id === e.groupId);
            return (
              <Card key={e.id} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: cat.soft }]}>
                  <Text style={{ fontSize: 18 }}>💳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.ink }]} numberOfLines={1}>{e.title}</Text>
                  <Text style={[styles.sub, { color: t.ink3 }]} numberOfLines={1}>
                    {payer.you ? "You paid" : `${payer.name} paid`} · {group?.name ?? "—"}
                  </Text>
                  <Text style={[styles.date, { color: t.ink4 }]}>{e.date}{e.time ? ` · ${e.time}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amt, { color: t.ink }]}>{fmt(e.amount, e.currency)}</Text>
                  <View style={[styles.catPill, { backgroundColor: cat.pillBg }]}>
                    <Text style={{ color: cat.pillFg, fontSize: 10, fontWeight: "700" }}>{cat.name}</Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: PILL, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 11, marginTop: 2 },
  amt: { fontSize: 16, fontWeight: "800" },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL, marginTop: 4 },
});
