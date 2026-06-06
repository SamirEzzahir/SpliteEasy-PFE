import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useGroup, useGroupMembers } from '../../src/hooks/useGroups'
import { useExpenses, useCreateExpense, useDeleteExpense } from '../../src/hooks/useExpenses'
import { useBalances } from '../../src/hooks/useSettlements'
import { useFriends } from '../../src/hooks/useFriends'
import { useAuthStore } from '../../src/store/authStore'
import { Card } from '../../src/components/common/Card'
import { Avatar } from '../../src/components/common/Avatar'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'
import { CURRENCIES } from '../../src/constants/config'

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

type Tab = 'expenses' | 'balances' | 'members'

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const groupId = Number(id)
  const router = useRouter()
  const { user } = useAuthStore()

  const { data: group, isLoading: groupLoading } = useGroup(groupId)
  const { data: members } = useGroupMembers(groupId)
  const { data: balances } = useBalances(groupId)
  const { data: friends } = useFriends()

  const {
    data: expensesData,
    isLoading: expLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useExpenses(groupId)

  const createExpense = useCreateExpense(groupId)
  const deleteExpense = useDeleteExpense(groupId)

  const [tab, setTab] = useState<Tab>('expenses')
  const [showModal, setShowModal] = useState(false)
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(group?.currency || 'USD')
  const [splitType, setSplitType] = useState<'equal' | 'percentage'>('equal')

  const allExpenses = (expensesData?.pages ?? [])
    .flatMap((p: any) => p?.expenses ?? p?.items ?? [])
    .filter((expense: any) => expense && expense.id != null)

  const handleCreate = useCallback(async () => {
    if (!desc.trim()) { Alert.alert('Error', 'Description is required.'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return }
    try {
      await createExpense.mutateAsync({
        group_id: groupId,
        payer_id: user?.id || members?.[0]?.user_id || 0,
        description: desc.trim(),
        amount: amt,
        split_type: splitType,
        splits: [],
      })
      setShowModal(false); setDesc(''); setAmount('')
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to create expense.')
    }
  }, [desc, amount, currency, splitType, groupId])

  const handleDelete = useCallback((expId: number) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteExpense.mutate(expId),
      },
    ])
  }, [groupId])

  if (groupLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8f9ff', padding: 16 }}>
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Group Header */}
      <View style={styles.groupHeader}>
        <View style={styles.groupIconBox}>
          <Text style={{ fontSize: 28 }}>
            {group?.type === 'Trip' ? '✈️' : group?.type === 'Home' ? '🏠' : group?.type === 'Couple' ? '❤️' : group?.type === 'Work' ? '💼' : '👥'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName}>{group?.title}</Text>
          <Text style={styles.groupMeta}>{group?.type} · {members?.length ?? 0} members · {group?.currency}</Text>
        </View>
        <TouchableOpacity style={styles.settleBtn} onPress={() => router.push(`/settle/${groupId}`)}>
          <Text style={styles.settleBtnText}>Settle</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['expenses', 'balances', 'members'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {tab === 'expenses' && (
        <>
          {expLoading ? (
            <View style={{ padding: 16 }}>
              {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
            </View>
          ) : (
            <FlatList
              data={allExpenses}
              keyExtractor={(e, index) => String(e?.id ?? `expense-${index}`)}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={isFetching && !expLoading} onRefresh={refetch} tintColor="#4a5cff" />}
              ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
              onEndReached={() => hasNextPage && fetchNextPage()}
              onEndReachedThreshold={0.3}
              ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#4a5cff" style={{ marginVertical: 16 }} /> : null}
              renderItem={({ item: e }) => (
                <Card style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    <View style={styles.expenseIcon}><Text>🧾</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseDesc}>{e.description}</Text>
                      <Text style={styles.expenseMeta}>
                        {e.payer_username || e.added_by_username || 'Unknown'} · {relTime(e.created_at)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.expenseAmount}>{money(e.amount, e.currency)}</Text>
                      {e.payer_id === user?.id && (
                        <TouchableOpacity onPress={() => handleDelete(e.id)}>
                          <Text style={styles.deleteText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {e.splits && e.splits.length > 0 && (
                    <View style={styles.splitsRow}>
                      {e.splits.map((s: any, i: number) => (
                        <Text key={`${s.user_id}-${s.id ?? i}`} style={styles.splitChip}>
                          {s.username}: {money(s.share_amount, e.currency)}
                        </Text>
                      ))}
                    </View>
                  )}
                </Card>
              )}
            />
          )}

          {/* FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
            <Text style={styles.fabText}>+ Add</Text>
          </TouchableOpacity>
        </>
      )}

      {tab === 'balances' && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {!balances ? (
            <CardSkeleton />
          ) : balances.length === 0 ? (
            <Text style={styles.empty}>All settled up! 🎉</Text>
          ) : (
            balances.map((b, i) => (
              <Card key={i} style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <Avatar name={(b as any).from_username || b.username || 'User'} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.balanceText}>
                      <Text style={{ fontWeight: '700' }}>{(b as any).from_username || b.username || 'User'}</Text>
                      {Number((b as any).amount ?? b.net) < 0 ? ' owes ' : ' is owed '}
                      <Text style={{ fontWeight: '700' }}>{(b as any).to_username || 'you'}</Text>
                    </Text>
                  </View>
                  <Text style={styles.balanceAmount}>{money(Math.abs(Number((b as any).amount ?? b.net ?? 0)), (b as any).currency || group?.currency)}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'members' && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {(members || []).map(m => (
            <Card key={m.user_id} style={styles.memberCard}>
              <View style={styles.memberRow}>
                <Avatar name={m.username || 'Member'} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>{m.username}</Text>
                  <Text style={styles.memberRole}>{m.is_admin ? 'Admin' : 'Member'}</Text>
                </View>
                {m.user_id === user?.id && (
                  <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
                )}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Add Expense Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Expense</Text>

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={desc} onChangeText={setDesc}
              placeholder="e.g. Dinner" placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount}
              placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Currency</Text>
            <View style={styles.chipRow}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]}
                  onPress={() => setCurrency(c)}>
                  <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Split</Text>
            <View style={styles.chipRow}>
              {(['equal', 'percentage'] as const).map(s => (
                <TouchableOpacity key={s} style={[styles.chip, splitType === s && styles.chipActive]}
                  onPress={() => setSplitType(s)}>
                  <Text style={[styles.chipText, splitType === s && styles.chipTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}
                disabled={createExpense.isPending}>
                {createExpense.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.createBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  groupIconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#eef0ff', alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 18, fontWeight: '800', color: '#1e1b4b' },
  groupMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  settleBtn: { backgroundColor: '#4a5cff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  settleBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#4a5cff' },
  tabText: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  tabTextActive: { color: '#4a5cff' },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 32 },
  expenseCard: { padding: 12, marginBottom: 10 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expenseIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  expenseDesc: { fontSize: 14, fontWeight: '700', color: '#1e1b4b' },
  expenseMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#1e1b4b' },
  deleteText: { fontSize: 11, color: '#ef4444', marginTop: 3 },
  splitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  splitChip: { fontSize: 11, color: '#6b7280', backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#4a5cff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, shadowColor: '#4a5cff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  balanceCard: { padding: 14, marginBottom: 10 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceText: { fontSize: 14, color: '#374151' },
  balanceAmount: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  memberCard: { padding: 14, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
  memberRole: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  youBadge: { backgroundColor: '#eef0ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  youBadgeText: { fontSize: 11, color: '#4a5cff', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  chipActive: { borderColor: '#4a5cff', backgroundColor: '#eef0ff' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#4a5cff', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
  createBtn: { flex: 1, backgroundColor: '#4a5cff', borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
