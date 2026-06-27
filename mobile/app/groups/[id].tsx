// app/groups/[id].tsx — single group detail: header, members, balances, expenses.
// Ported from app/groups/[id]/page.tsx (content-faithful). Pushed on top of the
// Groups tab via router.push(`/groups/<id>`).

import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { groupsApi } from "@/lib/api/groups";
import { expensesApi } from "@/lib/api/expenses";
import { settleApi } from "@/lib/api/settle";
import { mapExpense } from "@/lib/api/mappers";
import { registerUsers } from "@/lib/people-cache";
import { personById, categoryById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { RADIUS, useTheme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import GroupChat from "@/components/chat/GroupChat";
import type { ApiGroup, ApiMembership, ApiBalanceEntry } from "@/lib/api/types";
import type { Expense } from "@/lib/types";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id);
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<ApiGroup | null>(null);
  const [members, setMembers] = useState<ApiMembership[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<ApiBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(gid)) return;
    setLoading(true);
    try {
      const [g, mem, exp, bal] = await Promise.all([
        groupsApi.get(gid),
        groupsApi.members(gid).catch(() => []),
        expensesApi.listForGroup(gid).catch(() => []),
        settleApi.groupBalances(gid).catch(() => []),
      ]);
      registerUsers(mem.map((m) => m.user!).filter(Boolean));
      setGroup(g);
      setMembers(mem);
      setExpenses(exp.map(mapExpense));
      setBalances(bal);
    } finally {
      setLoading(false);
    }
  }, [gid]);

  useEffect(() => { void load(); }, [load]);

  const currency = group?.currency || "USD";
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: t.surface, borderBottomColor: t.line }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: t.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.ink }]} numberOfLines={1}>
          {group?.title ?? "Group"}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton height={90} radius={RADIUS} />
            <Skeleton height={60} radius={RADIUS} />
            <Skeleton height={60} radius={RADIUS} />
          </View>
        ) : !group ? (
          <EmptyState icon="❓" title="Group not found" />
        ) : (
          <>
            {/* Summary */}
            <Card style={styles.summary}>
              <Text style={[styles.sumLabel, { color: t.ink3 }]}>Total spent</Text>
              <Text style={[styles.sumValue, { color: t.ink }]}>{fmt(total, currency)}</Text>
              <Text style={[styles.sumHint, { color: t.ink4 }]}>{members.length} members · {expenses.length} expenses</Text>
            </Card>

            {/* Members */}
            <Text style={[styles.section, { color: t.ink2 }]}>Members</Text>
            <View style={styles.memberRow}>
              {members.map((m) => {
                const p = personById(String(m.user_id));
                return (
                  <View key={m.id} style={styles.member}>
                    <Avatar person={{ name: m.username || p.name, color: p.color, color2: p.color2 }} size={48} />
                    <Text style={[styles.memberName, { color: t.ink2 }]} numberOfLines={1}>
                      {m.username || p.name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Balances */}
            {balances.length > 0 && (
              <>
                <Text style={[styles.section, { color: t.ink2 }]}>Balances</Text>
                <View style={{ paddingHorizontal: 16, gap: 8 }}>
                  {balances.map((b) => {
                    const net = b.net ?? b.balance ?? 0;
                    const p = personById(String(b.user_id));
                    return (
                      <Card key={b.user_id} style={styles.balRow}>
                        <Text style={[styles.memberName, { color: t.ink, flex: 1 }]}>{b.username || p.name}</Text>
                        <Text style={{ color: net === 0 ? t.ink4 : net > 0 ? t.success : t.rose, fontWeight: "800" }}>
                          {net === 0 ? "settled" : `${net > 0 ? "+" : "-"}${fmt(Math.abs(net), currency)}`}
                        </Text>
                      </Card>
                    );
                  })}
                </View>
              </>
            )}

            {/* Expenses */}
            <Text style={[styles.section, { color: t.ink2 }]}>Expenses</Text>
            {expenses.length === 0 ? (
              <EmptyState icon="🧾" title="No expenses" message="Add the first expense for this group." />
            ) : (
              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {expenses.map((e) => {
                  const cat = categoryById(e.categoryId);
                  const payer = personById(e.paidBy);
                  return (
                    <Card key={e.id} style={styles.expRow}>
                      <View style={[styles.expIcon, { backgroundColor: cat.soft }]}>
                        <Text style={{ fontSize: 18 }}>💳</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.expTitle, { color: t.ink }]} numberOfLines={1}>{e.title}</Text>
                        <Text style={[styles.expSub, { color: t.ink3 }]} numberOfLines={1}>
                          {payer.you ? "You paid" : `${payer.name} paid`} · {e.date}
                        </Text>
                      </View>
                      <Text style={[styles.expAmt, { color: t.ink }]}>{fmt(e.amount, e.currency || currency)}</Text>
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {group && <GroupChat groupId={gid} groupName={group.title} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  back: { fontSize: 16, fontWeight: "700", width: 50 },
  headerTitle: { fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  summary: { margin: 16, alignItems: "flex-start" },
  sumLabel: { fontSize: 13, fontWeight: "700" },
  sumValue: { fontSize: 30, fontWeight: "900", marginTop: 4 },
  sumHint: { fontSize: 13, marginTop: 4 },
  section: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, paddingHorizontal: 16, marginTop: 12, marginBottom: 10 },
  memberRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 16 },
  member: { alignItems: "center", width: 64, gap: 4 },
  memberName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  balRow: { flexDirection: "row", alignItems: "center" },
  expRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  expIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expTitle: { fontSize: 15, fontWeight: "700" },
  expSub: { fontSize: 12, marginTop: 2 },
  expAmt: { fontSize: 16, fontWeight: "800" },
});
