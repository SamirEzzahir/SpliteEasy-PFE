// app/(tabs)/jars.tsx — Économé 6-jar dashboard + log-income modal.
// Ported from app/jars/page.tsx (content-faithful).

import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/format";
import { PILL, RADIUS, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui/Screen";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function JarsScreen() {
  const { jars, income, totalInJars, hasIncome, logIncome, refetchEconome } = useApp();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      await logIncome(n, label.trim() || "Income");
      setModal(false);
      setAmount("");
      setLabel("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Screen onRefresh={refetchEconome}>
        <PageHeader title="Jars" subtitle="Économé · 6-jar budgeting" />

        <Card style={styles.hero}>
          <Text style={[styles.heroLabel, { color: t.ink3 }]}>Total distributed</Text>
          <Text style={[styles.heroValue, { color: t.ink }]}>{fmt(hasIncome ? totalInJars : income)}</Text>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: t.primary }]} onPress={() => setModal(true)}>
            <Text style={styles.logBtnText}>+ Log income</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 12 }}>
          {jars.map((j) => {
            const allocated = income * (j.pct / 100);
            const used = j.kind === "save" ? j.saved : j.spent;
            const ratio = allocated > 0 ? Math.min(1, used / allocated) : 0;
            return (
              <Card key={j.id} style={styles.jar}>
                <View style={styles.jarTop}>
                  <View style={[styles.jarIcon, { backgroundColor: j.soft }]}>
                    <Text style={{ fontSize: 20 }}>{jarEmoji(j.id)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jarName, { color: t.ink }]}>{j.name}</Text>
                    <Text style={[styles.jarDesc, { color: t.ink3 }]} numberOfLines={1}>{j.desc}</Text>
                  </View>
                  <View style={[styles.pctPill, { backgroundColor: j.soft }]}>
                    <Text style={{ color: j.color, fontWeight: "800", fontSize: 12 }}>{j.pct}%</Text>
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: t.line2 }]}>
                  <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: j.color }]} />
                </View>
                <View style={styles.jarBottom}>
                  <Text style={[styles.jarUsed, { color: t.ink2 }]}>
                    {j.kind === "save" ? "Saved" : "Spent"} {fmt(used)}
                  </Text>
                  <Text style={[styles.jarAlloc, { color: t.ink4 }]}>of {fmt(allocated)}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      </Screen>

      {/* Log income modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 20, borderColor: t.line }]}>
            <View style={[styles.grabber, { backgroundColor: t.line }]} />
            <Text style={[styles.sheetTitle, { color: t.ink }]}>Log income</Text>
            <Text style={[styles.fieldLabel, { color: t.ink2 }]}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={t.ink4}
              style={[styles.input, { backgroundColor: t.bg, borderColor: t.line, color: t.ink }]}
            />
            <Text style={[styles.fieldLabel, { color: t.ink2 }]}>Source (optional)</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Salary, freelance…"
              placeholderTextColor={t.ink4}
              style={[styles.input, { backgroundColor: t.bg, borderColor: t.line, color: t.ink }]}
            />
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: t.primary, opacity: busy ? 0.7 : 1 }]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.submitText}>{busy ? "Distributing…" : "Distribute to jars"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function jarEmoji(id: string): string {
  switch (id) {
    case "necessities": return "🏠";
    case "financial": return "📈";
    case "savings": return "🎯";
    case "education": return "📚";
    case "play": return "🎉";
    case "give": return "🎁";
    default: return "💰";
  }
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 16, alignItems: "flex-start", gap: 6 },
  heroLabel: { fontSize: 13, fontWeight: "700" },
  heroValue: { fontSize: 32, fontWeight: "900" },
  logBtn: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: PILL },
  logBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  jar: { gap: 10 },
  jarTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  jarIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  jarName: { fontSize: 15, fontWeight: "800" },
  jarDesc: { fontSize: 12, marginTop: 2 },
  pctPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  jarBottom: { flexDirection: "row", justifyContent: "space-between" },
  jarUsed: { fontSize: 13, fontWeight: "700" },
  jarAlloc: { fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "900", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  submit: { marginTop: 20, borderRadius: RADIUS, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
