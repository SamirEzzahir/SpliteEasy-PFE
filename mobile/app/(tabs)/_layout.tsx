// app/(tabs)/_layout.tsx — bottom tab bar with a center FAB action sheet.
//
// Replaces the web MobileBottomNav + its center FAB. A custom tab bar renders
// four primary tabs (Dashboard, Groups, Expenses, Friends) with a raised FAB in
// the middle that opens an action sheet: Add Expense, Create Group, Record
// Settlement, Add Income. Jars & Settings are routable but reached from the
// Dashboard header / quick actions rather than the bar (keeps the bar uncluttered).

import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/lib/theme";
import { AddExpenseModal } from "@/components/modals/AddExpenseModal";
import { CreateGroupModal } from "@/components/modals/CreateGroupModal";

type SheetAction = "expense" | "group" | "settlement" | "income";

const PRIMARY_TABS = ["dashboard", "groups", "expenses", "friends"] as const;
const TAB_META: Record<string, { icon: string; label: string }> = {
  dashboard: { icon: "🏠", label: "Home" },
  groups: { icon: "👥", label: "Groups" },
  expenses: { icon: "🧾", label: "Expenses" },
  friends: { icon: "🤝", label: "Friends" },
};

const SHEET_ACTIONS: { icon: string; label: string; action: SheetAction }[] = [
  { icon: "🧾", label: "Add Expense", action: "expense" },
  { icon: "👥", label: "Create Group", action: "group" },
  { icon: "💸", label: "Record Settlement", action: "settlement" },
  { icon: "💰", label: "Add Income", action: "income" },
];

function ActionSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (a: SheetAction) => void;
}) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: t.surface, paddingBottom: insets.bottom + 16, borderColor: t.line },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: t.line }]} />
          <Text style={[styles.sheetTitle, { color: t.ink }]}>Quick actions</Text>
          {SHEET_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionRow, { borderColor: t.line2 }]}
              onPress={() => onSelect(a.action)}
            >
              <View style={[styles.actionIcon, { backgroundColor: t.primarySoft }]}>
                <Text style={{ fontSize: 20 }}>{a.icon}</Text>
              </View>
              <Text style={[styles.actionLabel, { color: t.ink }]}>{a.label}</Text>
              <Text style={[styles.chevron, { color: t.ink4 }]}>›</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modal, setModal] = useState<null | "expense" | "group">(null);

  const handleAction = (a: SheetAction) => {
    setSheetOpen(false);
    if (a === "expense") setModal("expense");
    else if (a === "group") setModal("group");
    else if (a === "settlement") router.push("/(tabs)/settlements");
    else if (a === "income") router.push("/(tabs)/jars");
  };

  const routeByName = new Map(state.routes.map((r) => [r.name, r]));
  const activeName = state.routes[state.index]?.name;

  const renderTab = (name: string) => {
    const route = routeByName.get(name);
    if (!route) return <View key={name} style={styles.tabItem} />;
    const meta = TAB_META[name];
    const focused = activeName === name;
    return (
      <TouchableOpacity
        key={name}
        style={styles.tabItem}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Text style={[styles.tabIcon, { opacity: focused ? 1 : 0.5 }]}>{meta.icon}</Text>
        <Text style={[styles.tabLabel, { color: focused ? t.primary : t.ink4 }]}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: insets.bottom, height: 60 + insets.bottom },
        ]}
      >
        {renderTab("dashboard")}
        {renderTab("groups")}
        <View style={styles.fabSlot}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.fab, { backgroundColor: t.primary }]}
            onPress={() => setSheetOpen(true)}
          >
            <Text style={styles.fabPlus}>+</Text>
          </TouchableOpacity>
        </View>
        {renderTab("expenses")}
        {renderTab("friends")}
      </View>
      <ActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onSelect={handleAction} />
      <AddExpenseModal visible={modal === "expense"} onClose={() => setModal(null)} />
      <CreateGroupModal visible={modal === "group"} onClose={() => setModal(null)} />
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="jars" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="settlements" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 10, fontWeight: "700" },
  fabSlot: { width: 64, alignItems: "center" },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowColor: "#5b4ef0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPlus: { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 34 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  sheetTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, opacity: 0.7 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 16, fontWeight: "600" },
  chevron: { fontSize: 22, fontWeight: "300" },
});
