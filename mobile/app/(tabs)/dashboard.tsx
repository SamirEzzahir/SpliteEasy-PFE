// app/(tabs)/dashboard.tsx — summary stats, recent expenses, quick actions.
// Ported from app/dashboard/page.tsx (content-faithful).

import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { fmt } from "@/lib/format";
import { personById, categoryById } from "@/lib/data";
import { RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DashboardScreen() {
  const { user } = useAuth();
  const { friends, expenses, groups, loading, refetchSplitting } = useApp();
  const { t } = useTheme();
  const router = useRouter();

  const { owed, owe, net } = useMemo(() => {
    let owed = 0;
    let owe = 0;
    for (const f of friends) {
      if (f.status !== "friend") continue;
      if (f.balance > 0) owed += f.balance;
      else if (f.balance < 0) owe += -f.balance;
    }
    return { owed, owe, net: owed - owe };
  }, [friends]);

  const recent = useMemo(
    () => [...expenses].sort((a, b) => (b._rawDate || "").localeCompare(a._rawDate || "")).slice(0, 6),
    [expenses],
  );

  const greeting = user?.full_name || user?.username || "there";

  return (
    <Screen onRefresh={refetchSplitting} refreshing={loading}>
      <PageHeader title={`Hi, ${greeting}`} subtitle="Here's where things stand" />

      {/* Net balance hero */}
      <Card style={styles.hero}>
        <Text style={[styles.heroLabel, { color: t.ink3 }]}>Your net balance</Text>
        {loading ? (
          <Skeleton width={160} height={34} style={{ marginTop: 8 }} />
        ) : (
          <Text style={[styles.heroValue, { color: net >= 0 ? t.success : t.rose }]}>
            {net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}
          </Text>
        )}
        <Text style={[styles.heroHint, { color: t.ink4 }]}>
          {net >= 0 ? "You are owed overall" : "You owe overall"}
        </Text>
      </Card>

      {/* Owed / Owe stat cards */}
      <View style={styles.statRow}>
        <Card style={[styles.stat, { flex: 1 }]}>
          <Text style={[styles.statLabel, { color: t.ink3 }]}>You are owed</Text>
          <Text style={[styles.statValue, { color: t.success }]}>{fmt(owed)}</Text>
        </Card>
        <Card style={[styles.stat, { flex: 1 }]}>
          <Text style={[styles.statLabel, { color: t.ink3 }]}>You owe</Text>
          <Text style={[styles.statValue, { color: t.rose }]}>{fmt(owe)}</Text>
        </Card>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {[
          { icon: "👥", label: "Groups", route: "/(tabs)/groups" },
          { icon: "💰", label: "Jars", route: "/(tabs)/jars" },
          { icon: "💸", label: "Settle", route: "/(tabs)/settlements" },
          { icon: "⚙️", label: "Settings", route: "/(tabs)/settings" },
        ].map((q) => (
          <TouchableOpacity
            key={q.label}
            style={styles.quick}
            onPress={() => router.push(q.route as never)}
          >
            <View style={[styles.quickIcon, { backgroundColor: t.primarySoft }]}>
              <Text style={{ fontSize: 22 }}>{q.icon}</Text>
            </View>
            <Text style={[styles.quickLabel, { color: t.ink2 }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent expenses */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: t.ink }]}>Recent activity</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/expenses")}>
          <Text style={{ color: t.primary, fontWeight: "700" }}>See all</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={60} radius={RADIUS} />
          ))}
        </View>
      ) : recent.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses yet"
          message="Add your first shared expense to see it here."
          ctaLabel="Go to Expenses"
          onCta={() => router.push("/(tabs)/expenses")}
        />
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {recent.map((e) => {
            const cat = categoryById(e.categoryId);
            const payer = personById(e.paidBy);
            const group = groups.find((g) => g.id === e.groupId);
            return (
              <Card key={e.id} style={styles.expRow}>
                <View style={[styles.expIcon, { backgroundColor: cat.soft }]}>
                  <Text style={{ fontSize: 18 }}>💳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expTitle, { color: t.ink }]} numberOfLines={1}>{e.title}</Text>
                  <Text style={[styles.expSub, { color: t.ink3 }]} numberOfLines={1}>
                    {payer.you ? "You" : payer.name} · {group?.name ?? "—"} · {e.date}
                  </Text>
                </View>
                <Text style={[styles.expAmt, { color: t.ink }]}>{fmt(e.amount, e.currency)}</Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 16, marginTop: 4, alignItems: "flex-start" },
  heroLabel: { fontSize: 13, fontWeight: "700" },
  heroValue: { fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroHint: { fontSize: 13, marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 12 },
  stat: { gap: 4 },
  statLabel: { fontSize: 13, fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "900" },
  quickRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 18 },
  quick: { alignItems: "center", gap: 6, flex: 1 },
  quickIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, fontWeight: "700" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  expRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  expIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expTitle: { fontSize: 15, fontWeight: "700" },
  expSub: { fontSize: 12, marginTop: 2 },
  expAmt: { fontSize: 16, fontWeight: "800" },
});
