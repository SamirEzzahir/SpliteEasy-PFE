// components/modals/AddExpenseModal.tsx — add a shared expense (RN bottom sheet).
// Ported from the web AddExpenseFullModal (essential flow: group, amount,
// description, category; split equally among the group's members).

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { CATEGORIES } from "@/lib/data";
import { PILL, RADIUS, useTheme } from "@/lib/theme";
import type { Expense } from "@/lib/types";

export function AddExpenseModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { groups, addExpense } = useApp();
  const { user } = useAuth();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  const [groupId, setGroupId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && !groupId && groups.length) setGroupId(groups[0].id);
  }, [visible, groups, groupId]);

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const currency = group?.currency || "MAD";

  const submit = async () => {
    const n = parseFloat(amount);
    if (!group || !n || n <= 0 || !title.trim() || !user) return;
    setBusy(true);
    try {
      // Split equally across the group's members (fall back to just the payer).
      const splitIds = group.memberIds.length ? group.memberIds : [String(user.id)];
      const exp: Expense = {
        id: "new",
        title: title.trim(),
        subtitle: "",
        groupId: group.id,
        paidBy: String(user.id),
        categoryId,
        amount: n,
        currency,
        date: "",
        time: "",
        splitIds,
      };
      await addExpense(exp);
      setAmount(""); setTitle("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 20, borderColor: t.line }]}>
          <View style={[styles.grabber, { backgroundColor: t.line }]} />
          <Text style={[styles.title, { color: t.ink }]}>Add expense</Text>

          {groups.length === 0 ? (
            <Text style={{ color: t.ink3, paddingVertical: 16 }}>Create a group first to add an expense.</Text>
          ) : (
            <>
              <Text style={[styles.label, { color: t.ink2 }]}>Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {groups.map((g) => {
                  const active = groupId === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setGroupId(g.id)}
                      style={[styles.pill, { borderColor: t.line, backgroundColor: active ? t.primary : t.bg }]}
                    >
                      <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 13 }}>{g.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.label, { color: t.ink2 }]}>Amount ({currency})</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={t.ink4}
                style={[styles.input, { backgroundColor: t.bg, borderColor: t.line, color: t.ink }]}
              />

              <Text style={[styles.label, { color: t.ink2 }]}>Description</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Dinner, taxi, hotel…"
                placeholderTextColor={t.ink4}
                style={[styles.input, { backgroundColor: t.bg, borderColor: t.line, color: t.ink }]}
              />

              <Text style={[styles.label, { color: t.ink2 }]}>Category</Text>
              <View style={styles.pillRow}>
                {CATEGORIES.map((c) => {
                  const active = categoryId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setCategoryId(c.id)}
                      style={[styles.pill, { borderColor: t.line, backgroundColor: active ? c.color : t.bg }]}
                    >
                      <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 12 }}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submit, { backgroundColor: t.primary, opacity: busy ? 0.6 : 1 }]}
                onPress={submit}
                disabled={busy}
              >
                <Text style={styles.submitText}>{busy ? "Adding…" : "Add expense"}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "900", marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: PILL, borderWidth: 1 },
  submit: { marginTop: 24, borderRadius: RADIUS, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
