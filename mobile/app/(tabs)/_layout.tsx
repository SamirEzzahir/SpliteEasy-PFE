import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useWsStore } from '../../src/store/wsStore'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>{label}</Text>
    </View>
  )
}

function NotifIcon({ focused }: { focused: boolean }) {
  const count = useWsStore((s) => s.unreadCount)
  return (
    <View style={styles.iconWrap}>
      <View>
        <Text style={{ fontSize: 22 }}>🔔</Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>Alerts</Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#4a5cff',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Groups" focused={focused} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🤝" label="Friends" focused={focused} /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ tabBarIcon: ({ focused }) => <NotifIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff', borderTopWidth: 0,
    shadowColor: '#4a5cff', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
    height: 64, paddingBottom: 8,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  iconLabel: { fontSize: 10, marginTop: 2, color: '#9ca3af', fontWeight: '500' },
  iconLabelActive: { color: '#4a5cff', fontWeight: '700' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
})
