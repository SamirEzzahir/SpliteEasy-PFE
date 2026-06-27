// components/modals/CreateGroupModal.tsx — create a group (RN bottom sheet).
// Ported from the web CreateGroupModal (essential fields).

import { useState } from "react";
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
import { PILL, RADIUS, useTheme } from "@/lib/theme";
import type { Group, GroupType } from "@/lib/types";

const CURRENCIES = ["MAD", "USD", "EUR", "GBP", "AED", "SAR"];
const TYPES: { id: GroupType; label: string; icon: string }[] = [
  { id: "trip", label: "Trip", icon: "✈️" },
  { id: "home", label: "Home", icon: "🏠" },
  { id: "social", label: "Social", icon: "🎉" },
  { id: "work", label: "Work", icon: "💼" },
];

export function CreateGroupModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createGroup } = useApp();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("MAD");
  const [type, setType] = useState<GroupType>("trip");
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(""); setCurrency("MAD"); setType("trip"); };

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const g: Group = {
        id: "new", name: name.trim(), type, currency,
        icon: "groups", color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b",
        memberIds: [], total: 0, balance: 0, updated: "just now",
      };
      await createGroup(g);
      reset();
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
          <Text style={[styles.title, { color: t.ink }]}>Create group</Text>

          <Text style={[styles.label, { color: t.ink2 }]}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Trip to Istanbul"
            placeholderTextColor={t.ink4}
            style={[styles.input, { backgroundColor: t.bg, borderColor: t.line, color: t.ink }]}
          />

          <Text style={[styles.label, { color: t.ink2 }]}>Type</Text>
          <View style={styles.pillRow}>
            {TYPES.map((ty) => {
              const active = type === ty.id;
              return (
                <TouchableOpacity
                  key={ty.id}
                  onPress={() => setType(ty.id)}
                  style={[styles.pill, { borderColor: t.line, backgroundColor: active ? t.primary : t.bg }]}
                >
                  <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 13 }}>
                    {ty.icon} {ty.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: t.ink2 }]}>Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CURRENCIES.map((c) => {
              const active = currency === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCurrency(c)}
                  style={[styles.pill, { borderColor: t.line, backgroundColor: active ? t.primary : t.bg }]}
                >
                  <Text style={{ color: active ? "#fff" : t.ink2, fontWeight: "700", fontSize: 13 }}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: t.primary, opacity: busy || !name.trim() ? 0.6 : 1 }]}
            onPress={submit}
            disabled={busy || !name.trim()}
          >
            <Text style={styles.submitText}>{busy ? "Creating…" : "Create group"}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "900", marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: PILL, borderWidth: 1 },
  submit: { marginTop: 24, borderRadius: RADIUS, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
