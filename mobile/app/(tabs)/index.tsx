import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../src/store/authStore'
import { dashboardApi } from '../../src/api/dashboard'
import { groupsApi } from '../../src/api/groups'
import { Card } from '../../src/components/common/Card'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'
import { Avatar } from '../../src/components/common/Avatar'

function money(n: number, currency = 'USD') {
  return `${Number(n).toFixed(2)} ${currency}`
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function HomeScreen() {
  const { user } = useAuthStore()
  const router = useRouter()

  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary().then(r => r.data),
  })

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list().then(r => r.data),
  })

  const activity = useQuery({
    queryKey: ['activity'],
    queryFn: () => dashboardApi.activity().then(r => r.data),
  })

  const isRefreshing = summary.isFetching || groups.isFetching
  function refresh() {
    summary.refetch(); groups.refetch(); activity.refetch()
  }

  const s = summary.data

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#4a5cff" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day 👋</Text>
          <Text style={styles.username}>{user?.username || 'SplitEasy'}</Text>
        </View>
        {user && <Avatar name={user.username} size={44} />}
      </View>

      {/* KPI Cards */}
      {summary.isLoading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : (
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#4a5cff' }]}>
            <Text style={styles.kpiLabel}>Net Balance</Text>
            <Text style={styles.kpiValue}>{s ? money(s.net_balance) : '—'}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#10b981' }]}>
            <Text style={styles.kpiLabel}>Total Income</Text>
            <Text style={styles.kpiValue}>{s ? money(s.total_income) : '—'}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#f59e0b' }]}>
            <Text style={styles.kpiLabel}>Total Expenses</Text>
            <Text style={styles.kpiValue}>{s ? money(s.total_expense) : '—'}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#7c4dff' }]}>
            <Text style={styles.kpiLabel}>Active Groups</Text>
            <Text style={styles.kpiValue}>{groups.data?.length ?? '—'}</Text>
          </View>
        </View>
      )}

      {/* Recent Expenses */}
      <Text style={styles.sectionTitle}>Recent Expenses</Text>
      {summary.isLoading ? (
        <CardSkeleton />
      ) : (
        <Card>
          {(s?.recent_expenses?.length ?? 0) === 0 ? (
            <Text style={styles.empty}>No expenses yet.</Text>
          ) : (
            s!.recent_expenses.slice(0, 5).map((e, i) => (
              <View key={i} style={styles.expenseRow}>
                <View style={styles.expenseIcon}><Text>🧾</Text></View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc}>{e.description}</Text>
                  <Text style={styles.expenseDate}>{relTime(e.created_at)}</Text>
                </View>
                <Text style={styles.expenseAmount}>{money(e.amount, e.currency)}</Text>
              </View>
            ))
          )}
        </Card>
      )}

      {/* My Groups */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Groups</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      {groups.isLoading ? (
        <CardSkeleton />
      ) : (
        (groups.data || []).slice(0, 4).map((g) => (
          <TouchableOpacity key={g.id} onPress={() => router.push(`/group/${g.id}`)}>
            <Card style={styles.groupCard}>
              <View style={styles.groupRow}>
                <View style={[styles.groupIcon, g.has_unsettled_balance && styles.groupIconUnsettled]}>
                  <Text style={styles.groupEmoji}>
                    {g.type === 'Trip' ? '✈️' : g.type === 'Home' ? '🏠' : g.type === 'Couple' ? '❤️' : '👥'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{g.title}</Text>
                  <Text style={styles.groupMeta}>{g.members_usernames?.length ?? 0} members • {g.currency}</Text>
                </View>
                <View>
                  <Text style={styles.groupAmount}>{money(g.total_amount ?? 0, g.currency)}</Text>
                  {g.has_unsettled_balance && <Text style={styles.unsettledBadge}>Unsettled</Text>}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      {/* Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <Card>
        {(activity.data?.length ?? 0) === 0 ? (
          <Text style={styles.empty}>{activity.isLoading ? 'Loading...' : 'No activity yet.'}</Text>
        ) : (
          (activity.data || []).slice(0, 5).map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <Text style={styles.activityDot}>•</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityAction}>{a.action}</Text>
                <Text style={styles.activityDate}>{relTime(a.created_at)}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8f9ff' },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greeting: { fontSize: 13, color: '#6b7280' },
  username: { fontSize: 22, fontWeight: '800', color: '#1e1b4b' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    flex: 1, minWidth: '45%', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  kpiLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  kpiValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginTop: 8, marginBottom: 10 },
  seeAll: { fontSize: 13, color: '#4a5cff', fontWeight: '600' },
  empty: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  expenseIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#111827' },
  expenseDate: { fontSize: 12, color: '#9ca3af' },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#1e1b4b' },
  groupCard: { padding: 14 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#eef0ff', alignItems: 'center', justifyContent: 'center' },
  groupIconUnsettled: { backgroundColor: '#fef3c7' },
  groupEmoji: { fontSize: 20 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
  groupMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  groupAmount: { fontSize: 14, fontWeight: '700', color: '#1e1b4b', textAlign: 'right' },
  unsettledBadge: { fontSize: 10, color: '#f59e0b', fontWeight: '700', textAlign: 'right', marginTop: 2 },
  activityRow: { flexDirection: 'row', paddingVertical: 6, gap: 8 },
  activityDot: { color: '#4a5cff', fontSize: 18, lineHeight: 20 },
  activityAction: { fontSize: 13, color: '#374151' },
  activityDate: { fontSize: 11, color: '#9ca3af' },
})
