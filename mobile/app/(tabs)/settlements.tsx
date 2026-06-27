// app/(tabs)/settlements.tsx — global settlement history + outstanding balances.
// Ported from app/settlements/page.tsx (content-faithful).

import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { settleApi } from "@/lib/api/settle";
import { fmt } from "@/lib/format";
import { personById } from "@/lib/data";
import { RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ApiSettlement } from "@/lib/api/types";

export default function SettlementsScreen() {
  const { friends } = useApp();
  const { user } = useAuth();
  const { t } = useTheme();
  const [history, setHistory] = useState<ApiSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await settleApi.globalHistory());
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const outstanding = friends.filter((f) => f.status === "friend" && f.balance !== 0);

  const statusColor = (s: string) =>
    s === "accepted" ? t.success : s === "rejected" ? t.rose : t.warn;

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <PageHeader title="Settlements" subtitle="Who paid who" />

      <Text style={[styles.sectionTitle, { color: t.ink2 }]}>Outstanding</Text>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {outstanding.length === 0 ? (
          <Card><Text style={{ color: t.ink3, textAlign: "center" }}>You're all settled up 🎉</Text></Card>
        ) : (
          outstanding.map((f) => {
            const p = personById(f.personId);
            const positive = f.balance >= 0;
            return (
              <Card key={f.personId} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.ink }]}>{f.displayName || p.name}</Text>
                  <Text style={[styles.sub, { color: positive ? t.success : t.rose }]}>
                    {positive ? `owes you ${fmt(f.balance)}` : `you owe ${fmt(-f.balance)}`}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: t.ink2 }]}>History</Text>
      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={58} radius={RADIUS} />)}
        </View>
      ) : history.length === 0 ? (
        <EmptyState icon="💸" title="No settlements yet" message="Recorded settlements will show up here." />
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {history.map((s) => {
            const fromYou = s.from_user_id === user?.id;
            const other = fromYou ? (s.to_username || `#${s.to_user_id}`) : (s.from_username || `#${s.from_user_id}`);
            return (
              <Card key={s.id} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: t.tealSoft }]}>
                  <Text style={{ fontSize: 16 }}>💸</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>
                    {fromYou ? `You → ${other}` : `${other} → You`}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor(s.status) }]}>{s.status}</Text>
                </View>
                <Text style={[styles.amt, { color: t.ink }]}>{fmt(s.amount)}</Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, paddingHorizontal: 16, marginTop: 18, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  statusText: { fontSize: 12, fontWeight: "700", marginTop: 2, textTransform: "capitalize" },
  amt: { fontSize: 16, fontWeight: "800" },
});
