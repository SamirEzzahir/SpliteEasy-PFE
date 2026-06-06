import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useGroups, useCreateGroup } from '../../src/hooks/useGroups'
import { useFriends } from '../../src/hooks/useFriends'
import { Card } from '../../src/components/common/Card'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'
import { CURRENCIES, GROUP_TYPES } from '../../src/constants/config'

function money(n: number, currency = 'USD') {
  return `${Number(n).toFixed(2)} ${currency}`
}

export default function GroupsScreen() {
  const router = useRouter()
  const { data: groups, isLoading, refetch, isFetching } = useGroups()
  const { data: friends } = useFriends()
  const createGroup = useCreateGroup()

  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Trip')
  const [currency, setCurrency] = useState('USD')
  const [query, setQuery] = useState('')

  const filtered = (groups || []).filter(g =>
    !query || g.title.toLowerCase().includes(query.toLowerCase())
  )

  async function handleCreate() {
    if (!title.trim()) { Alert.alert('Error', 'Group name is required.'); return }
    try {
      await createGroup.mutateAsync({ title: title.trim(), type, currency, member_ids: [] })
      setShowModal(false); setTitle(''); setType('Trip'); setCurrency('USD')
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to create group.')
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.sub}>{groups?.length ?? 0} groups</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search groups..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={g => String(g.id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#4a5cff" />}
          ListEmptyComponent={
            <Text style={styles.empty}>No groups yet. Create one!</Text>
          }
          renderItem={({ item: g }) => (
            <TouchableOpacity onPress={() => router.push(`/group/${g.id}`)}>
              <Card style={styles.groupCard}>
                <View style={styles.groupRow}>
                  <View style={styles.groupIcon}>
                    <Text style={styles.groupEmoji}>
                      {g.type === 'Trip' ? '✈️' : g.type === 'Home' ? '🏠' : g.type === 'Couple' ? '❤️' : g.type === 'Work' ? '💼' : '👥'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{g.title}</Text>
                    <Text style={styles.groupMeta}>
                      {g.type} · {g.members_usernames?.length ?? 0} members
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.groupAmount}>{money(g.total_amount ?? 0, g.currency)}</Text>
                    <View style={[styles.badge, g.has_unsettled_balance ? styles.badgeUnsettled : styles.badgeSettled]}>
                      <Text style={styles.badgeText}>{g.has_unsettled_balance ? 'Unsettled' : 'Settled'}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Group</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Weekend Trip" placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {GROUP_TYPES.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]}
                  onPress={() => setType(t)}>
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Currency</Text>
            <View style={styles.chipRow}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]}
                  onPress={() => setCurrency(c)}>
                  <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}
                disabled={createGroup.isPending}>
                {createGroup.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.createBtnText}>Create</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#1e1b4b' },
  sub: { fontSize: 13, color: '#9ca3af' },
  addBtn: { backgroundColor: '#4a5cff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827',
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 32 },
  groupCard: { padding: 14 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#eef0ff', alignItems: 'center', justifyContent: 'center' },
  groupEmoji: { fontSize: 22 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
  groupMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  groupAmount: { fontSize: 14, fontWeight: '700', color: '#1e1b4b' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  badgeSettled: { backgroundColor: '#d1fae5' },
  badgeUnsettled: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa',
  },
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
