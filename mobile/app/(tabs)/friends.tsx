// app/(tabs)/friends.tsx — friends list, pending requests, balances.
// Ported from app/friends/page.tsx.

import { useMemo } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/format";
import { personById } from "@/lib/data";
import { PILL, RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";

export default function FriendsScreen() {
  const {
    friends, loading, refetchSplitting,
    acceptFriendRequest, rejectFriendRequest, removeFriend, settleFriend,
  } = useApp();
  const { t } = useTheme();

  const accepted = useMemo(() => friends.filter((f) => f.status === "friend"), [friends]);
  const received = useMemo(() => friends.filter((f) => f.status === "received"), [friends]);
  const sent = useMemo(() => friends.filter((f) => f.status === "sent"), [friends]);

  const confirmRemove = (friendshipId: number, name: string) => {
    Alert.alert("Remove friend", `Remove ${name} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeFriend(friendshipId) },
    ]);
  };

  return (
    <Screen onRefresh={refetchSplitting} refreshing={loading}>
      <PageHeader title="Friends" subtitle={`${accepted.length} friends`} />

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={RADIUS} />)}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {received.length > 0 && (
            <Section title="Requests received">
              {received.map((f) => {
                const p = personById(f.personId);
                return (
                  <Card key={f.requestId ?? f.personId} style={styles.row}>
                    <Avatar person={{ name: f.displayName || p.name, color: p.color, color2: p.color2 }} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{f.displayName || p.name}</Text>
                      <Text style={[styles.sub, { color: t.ink3 }]} numberOfLines={1}>{f.email}</Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: t.success }]}
                        onPress={() => f.requestId && acceptFriendRequest(f.requestId)}
                      >
                        <Text style={styles.smallBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: t.line }]}
                        onPress={() => f.requestId && rejectFriendRequest(f.requestId)}
                      >
                        <Text style={[styles.smallBtnText, { color: t.ink2 }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })}
            </Section>
          )}

          {sent.length > 0 && (
            <Section title="Requests sent">
              {sent.map((f) => {
                const p = personById(f.personId);
                return (
                  <Card key={f.requestId ?? f.personId} style={styles.row}>
                    <Avatar person={{ name: f.displayName || p.name, color: p.color, color2: p.color2 }} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{f.displayName || p.name}</Text>
                      <Text style={[styles.sub, { color: t.ink3 }]}>Pending…</Text>
                    </View>
                  </Card>
                );
              })}
            </Section>
          )}

          <Section title="Your friends">
            {accepted.length === 0 ? (
              <EmptyState icon="🤝" title="No friends yet" message="Add friends to split expenses together." />
            ) : (
              accepted.map((f) => {
                const p = personById(f.personId);
                const positive = f.balance >= 0;
                return (
                  <Card key={f.friendshipId ?? f.personId} style={styles.row}>
                    <Avatar person={{ name: f.displayName || p.name, color: p.color, color2: p.color2 }} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{f.displayName || p.name}</Text>
                      <Text style={[styles.sub, { color: f.balance === 0 ? t.ink3 : positive ? t.success : t.rose }]}>
                        {f.balance === 0 ? "Settled up" : positive ? `owes you ${fmt(f.balance)}` : `you owe ${fmt(-f.balance)}`}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      {f.balance !== 0 && (
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: t.teal }]}
                          onPress={() => settleFriend(f.personId)}
                        >
                          <Text style={styles.smallBtnText}>Settle</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => f.friendshipId && confirmRemove(f.friendshipId, f.displayName || p.name)}
                        style={[styles.smallBtn, { backgroundColor: t.line }]}
                      >
                        <Text style={[styles.smallBtnText, { color: t.ink2 }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
            )}
          </Section>
        </View>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12, gap: 10 }}>
      <Text style={[styles.sectionTitle, { color: t.ink2 }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: PILL },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
