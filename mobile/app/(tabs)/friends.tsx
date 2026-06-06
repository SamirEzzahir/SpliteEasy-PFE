import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import {
  useFriends, useReceivedRequests, useSentRequests,
  useSendFriendRequest, useAcceptFriendRequest, useRejectFriendRequest, useRemoveFriend,
} from '../../src/hooks/useFriends'
import { friendsApi } from '../../src/api/friends'
import { Card } from '../../src/components/common/Card'
import { Avatar } from '../../src/components/common/Avatar'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'

type Tab = 'friends' | 'requests' | 'sent'

export default function FriendsScreen() {
  const [tab, setTab] = useState<Tab>('friends')
  const [showModal, setShowModal] = useState(false)
  const [username, setUsername] = useState('')

  const { data: friends, isLoading, refetch, isFetching } = useFriends()
  const { data: received, refetch: refetchReceived } = useReceivedRequests()
  const { data: sent, refetch: refetchSent } = useSentRequests()

  const sendRequest = useSendFriendRequest()
  const acceptRequest = useAcceptFriendRequest()
  const rejectRequest = useRejectFriendRequest()
  const removeFriend = useRemoveFriend()

  function refresh() { refetch(); refetchReceived(); refetchSent() }

  async function handleSend() {
    if (!username.trim()) { Alert.alert('Error', 'Enter a username.'); return }
    try {
      const searchRes = await friendsApi.search(username.trim())
      const matchedUser = (searchRes.data || []).find((u: any) => u.username?.toLowerCase() === username.trim().toLowerCase()) || searchRes.data?.[0]
      if (!matchedUser?.id) {
        Alert.alert('Error', 'User not found.')
        return
      }
      await sendRequest.mutateAsync(matchedUser.id)
      setShowModal(false); setUsername('')
      Alert.alert('Sent', `Friend request sent to ${username}!`)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to send request.')
    }
  }

  async function handleAccept(friendshipId: number) {
    try { await acceptRequest.mutateAsync(friendshipId) }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed.') }
  }

  async function handleReject(friendshipId: number) {
    try { await rejectRequest.mutateAsync(friendshipId) }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed.') }
  }

  function handleRemove(friendshipId: number, name: string) {
    Alert.alert('Remove Friend', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend.mutate(friendshipId) },
    ])
  }

  const safeFriends = (friends || []).filter((f: any) => f && (f.friendship_id != null || f.id != null || f.user_id != null))
  const safeReceived = (received || []).filter((r: any) => r && r.id != null)
  const safeSent = (sent || []).filter((r: any) => r && r.id != null)
  const pendingCount = safeReceived.length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.sub}>{safeFriends.length} friends</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'friends' && styles.tabBtnActive]} onPress={() => setTab('friends')}>
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]} onPress={() => setTab('requests')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>Requests</Text>
            {pendingCount > 0 && (
              <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{pendingCount}</Text></View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]} onPress={() => setTab('sent')}>
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Sent</Text>
        </TouchableOpacity>
      </View>

      {/* Friends List */}
      {tab === 'friends' && (
        isLoading ? (
          <View style={{ padding: 16 }}>{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</View>
        ) : (
          <FlatList
            data={safeFriends}
            keyExtractor={(f: any, index) => String(f.friendship_id ?? f.id ?? f.user_id ?? `friend-${index}`)}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refresh} tintColor="#4a5cff" />}
            ListEmptyComponent={<Text style={styles.empty}>No friends yet. Add some!</Text>}
            renderItem={({ item: f }) => (
              <Card style={styles.friendCard}>
                <View style={styles.friendRow}>
                  <Avatar name={f.username} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.friendName}>{f.username}</Text>
                    {f.email && <Text style={styles.friendEmail}>{f.email}</Text>}
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(f.friendship_id ?? f.id, f.username)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          />
        )
      )}

      {/* Received Requests */}
      {tab === 'requests' && (
        <FlatList
          data={safeReceived}
          keyExtractor={(r, index) => String(r.id ?? `received-${index}`)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetchReceived} tintColor="#4a5cff" />}
          ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
          renderItem={({ item: r }) => (
            <Card style={styles.friendCard}>
              <View style={styles.friendRow}>
                <Avatar name={(r as any).from_username || (r as any).user_email || 'User'} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.friendName}>{(r as any).from_username || (r as any).user_email || 'User'}</Text>
                  <Text style={styles.friendEmail}>Wants to be your friend</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(r.id)}>
                    <Text style={styles.acceptBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(r.id)}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Sent Requests */}
      {tab === 'sent' && (
        <FlatList
          data={safeSent}
          keyExtractor={(r, index) => String(r.id ?? `sent-${index}`)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetchSent} tintColor="#4a5cff" />}
          ListEmptyComponent={<Text style={styles.empty}>No sent requests.</Text>}
          renderItem={({ item: r }) => (
            <Card style={styles.friendCard}>
              <View style={styles.friendRow}>
                <Avatar name={(r as any).to_username || (r as any).friend_email || 'User'} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.friendName}>{(r as any).to_username || (r as any).friend_email || 'User'}</Text>
                  <Text style={styles.friendEmail}>Pending...</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Add Friend Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter their username"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleSend} disabled={sendRequest.isPending}>
                {sendRequest.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.createBtnText}>Send Request</Text>}
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
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#4a5cff' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  tabTextActive: { color: '#4a5cff' },
  notifBadge: { backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 32 },
  friendCard: { padding: 14, marginBottom: 10 },
  friendRow: { flexDirection: 'row', alignItems: 'center' },
  friendName: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
  friendEmail: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  removeBtn: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  removeBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  acceptBtn: { backgroundColor: '#10b981', borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rejectBtn: { backgroundColor: '#ef4444', borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pendingBadge: { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pendingBadgeText: { fontSize: 12, color: '#f59e0b', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
  createBtn: { flex: 1, backgroundColor: '#4a5cff', borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
