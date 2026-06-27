// app/(tabs)/settings.tsx — profile, theme, currency, logout.
// Ported from app/settings/page.tsx (content-faithful).

import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { PILL, RADIUS, useTheme, type ThemeMode } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { userColors } from "@/lib/api/mappers";

const THEME_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t, mode, setMode } = useTheme();

  const name = user?.full_name || user?.username || "You";
  const colors = userColors(user?.id ?? 0);

  const confirmLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <PageHeader title="Settings" />

      {/* Profile card */}
      <Card style={styles.profile}>
        <Avatar person={{ name, color: colors.color, color2: colors.color2 }} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.ink }]}>{name}</Text>
          <Text style={[styles.email, { color: t.ink3 }]}>{user?.email ?? ""}</Text>
          {user?.preferred_currency ? (
            <View style={[styles.currencyPill, { backgroundColor: t.primarySoft }]}>
              <Text style={{ color: t.primary, fontWeight: "700", fontSize: 12 }}>
                {user.preferred_currency}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      {/* Appearance */}
      <Text style={[styles.sectionTitle, { color: t.ink2 }]}>Appearance</Text>
      <Card style={{ marginHorizontal: 16 }}>
        <Text style={[styles.rowLabel, { color: t.ink }]}>Theme</Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((o) => {
            const active = mode === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                onPress={() => setMode(o.id)}
                style={[styles.segBtn, { backgroundColor: active ? t.primary : t.bg, borderColor: t.line }]}
              >
                <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 13 }}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Account */}
      <Text style={[styles.sectionTitle, { color: t.ink2 }]}>Account</Text>
      <Card style={{ marginHorizontal: 16, gap: 0, paddingVertical: 4 }}>
        <Row label="Username" value={user?.username ?? "—"} />
        <Row label="Email" value={user?.email ?? "—"} last />
      </Card>

      <TouchableOpacity style={[styles.logout, { borderColor: t.rose }]} onPress={confirmLogout}>
        <Text style={[styles.logoutText, { color: t.rose }]}>Sign out</Text>
      </TouchableOpacity>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: t.line2, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.infoLabel, { color: t.ink3 }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: t.ink }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  name: { fontSize: 18, fontWeight: "900" },
  email: { fontSize: 13, marginTop: 2 },
  currencyPill: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL },
  sectionTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  rowLabel: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  segment: { flexDirection: "row", gap: 8 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS, borderWidth: 1, alignItems: "center" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, gap: 12 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  logout: { marginHorizontal: 16, marginTop: 24, borderWidth: 1.5, borderRadius: RADIUS, paddingVertical: 15, alignItems: "center" },
  logoutText: { fontSize: 16, fontWeight: "800" },
});
