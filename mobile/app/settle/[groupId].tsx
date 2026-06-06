import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useGroup } from '../../src/hooks/useGroups'
import {
  useBalances, useSuggestedSettlements, useSettlementHistory,
  usePendingSettlements, useRecordSettlement, useAcceptSettlement, useRejectSettlement,
} from '../../src/hooks/useSettlements'
import { useAuthStore } from '../../src/store/authStore'
import { Card } from '../../src/components/common/Card'
import { Avatar } from '../../src/components/common/Avatar'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'

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

type Tab = 'suggested' | 'pending' | 'history'

export default function SettleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const gid = Number(groupId)
  const { user } = useAuthStore()

  const { data: group } = useGroup(gid)
  const { data: balances, refetch: refetchBalances, isFetching: balFetching } = useBalances(gid)
  const { data: suggested, isLoading: sugLoading, refetch: refetchSug } = useSuggestedSettlements(gid)
  const { data: pending, isLoading: pendLoading, refetch: refetchPending } = usePendingSettlements(gid)
  const { data: history, isLoading: histLoading, refetch: refetchHist } = useSettlementHistory(gid)

  const recordSettlement = useRecordSettlement()
  const acceptSettlement = useAcceptSettlement()
  const rejectSettlement = useRejectSettlement()

  const [tab, setTab] = useState<Tab>('suggested')

  function refresh() {
    refetchBalances(); refetchSug(); refetchPending(); refetchHist()
  }

  async function handleRecord(toUserId: number, amount: number, currency: string) {
    Alert.alert(
      'Record Settlement',
      `Confirm payment of ${money(amount, currency)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await recordSettlement.mutateAsync({ group_id: gid, to_user_id: toUserId, amount, currency })
              Alert.alert('Done', 'Settlement recorded!')
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || 'Failed.')
            }
          },
        },
      ]
    )
  }

  async function handleAccept(settlementId: number) {
    try {
      await acceptSettlement.mutateAsync({ settlementId, groupId: gid })
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed.')
    }
  }

  async function handleReject(settlementId: number) {
    try {
      await rejectSettlement.mutateAsync({ settlementId, groupId: gid })
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed.')
    }
  }

  return (
    <View style={styles.container}>
      {/* Balance Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current Balances</Text>
        {balFetching ? (
          <ActivityIndicator color="#4a5cff" />
        ) : !balances || balances.length === 0 ? (
          <Text style={styles.allGood}>✅ All settled up!</Text>
        ) : (
          balances.slice(0, 3).map((b, i) => (
            <View key={i} style={styles.balRow}>
              <Text style={styles.balText}>
                <Text style={{ fontWeight: '700' }}>{b.from_username}</Text>
                {' → '}
                <Text style={{ fontWeight: '700' }}>{b.to_username}</Text>
              </Text>
              <Text style={styles.balAmt}>{money(b.amount, b.currency || group?.currency)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['suggested', 'pending', 'history'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#4a5cff" />}
      >
        {tab === 'suggested' && (
          sugLoading ? <CardSkeleton /> :
          !suggested || suggested.length === 0 ? (
            <Text style={styles.empty}>No settlements needed.</Text>
          ) : (
            suggested.map((s, i) => (
              <Card key={i} style={styles.settleCard}>
                <View style={styles.settleRow}>
                  <Avatar name={s.from_username} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.settleText}>
                      <Text style={{ fontWeight: '700' }}>{s.from_username}</Text>
                      {' pays '}
                      <Text style={{ fontWeight: '700' }}>{s.to_username}</Text>
                    </Text>
                    <Text style={styles.settleAmt}>{money(s.amount, s.currency || group?.currency)}</Text>
                  </View>
                  {s.from_user_id === user?.id && (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => handleRecord(s.to_user_id, s.amount, s.currency || group?.currency || 'USD')}
                      disabled={recordSettlement.isPending}
                    >
                      <Text style={styles.payBtnText}>Pay</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ))
          )
        )}

        {tab === 'pending' && (
          pendLoading ? <CardSkeleton /> :
          !pending || pending.length === 0 ? (
            <Text style={styles.empty}>No pending settlements.</Text>
          ) : (
            pending.map((s) => (
              <Card key={s.id} style={styles.settleCard}>
                <View style={styles.settleRow}>
                  <Avatar name={s.from_username} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.settleText}>
                      <Text style={{ fontWeight: '700' }}>{s.from_username}</Text>
                      {' → '}
                      <Text style={{ fontWeight: '700' }}>{s.to_username}</Text>
                    </Text>
                    <Text style={styles.settleAmt}>{money(s.amount, s.currency)}</Text>
                    <Text style={styles.settleMeta}>{relTime(s.created_at)}</Text>
                  </View>
                  {s.to_user_id === user?.id && (
                    <View style={{ gap: 8 }}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(s.id)}>
                        <Text style={styles.acceptBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(s.id)}>
                        <Text style={styles.rejectBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            ))
          )
        )}

        {tab === 'history' && (
          histLoading ? <CardSkeleton /> :
          !history || history.length === 0 ? (
            <Text style={styles.empty}>No settlement history.</Text>
          ) : (
            history.map((s) => (
              <Card key={s.id} style={styles.settleCard}>
                <View style={styles.settleRow}>
                  <Avatar name={s.from_username} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.settleText}>
                      <Text style={{ fontWeight: '700' }}>{s.from_username}</Text>
                      {' paid '}
                      <Text style={{ fontWeight: '700' }}>{s.to_username}</Text>
                    </Text>
                    <Text style={styles.settleAmt}>{money(s.amount, s.currency)}</Text>
                    <Text style={styles.settleMeta}>{relTime(s.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, s.status === 'accepted' ? styles.statusAccepted : styles.statusPending]}>
                    <Text style={styles.statusText}>{s.status}</Text>
                  </View>
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  summaryCard: { margin: 16, marginBottom: 0, padding: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#1e1b4b', marginBottom: 10 },
  allGood: { fontSize: 14, color: '#10b981', fontWeight: '600' },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  balText: { fontSize: 13, color: '#374151', flex: 1 },
  balAmt: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', marginTop: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#4a5cff' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  tabTextActive: { color: '#4a5cff' },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 32 },
  settleCard: { padding: 14, marginBottom: 10 },
  settleRow: { flexDirection: 'row', alignItems: 'center' },
  settleText: { fontSize: 14, color: '#374151' },
  settleAmt: { fontSize: 15, fontWeight: '700', color: '#1e1b4b', marginTop: 2 },
  settleMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  payBtn: { backgroundColor: '#4a5cff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  acceptBtn: { backgroundColor: '#10b981', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rejectBtn: { backgroundColor: '#ef4444', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusAccepted: { backgroundColor: '#d1fae5' },
  statusPending: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#374151' },
})
