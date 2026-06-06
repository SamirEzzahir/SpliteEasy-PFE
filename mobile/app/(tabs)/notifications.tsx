import { useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../../src/api/notifications'
import { useWsStore } from '../../src/store/wsStore'
import { Card } from '../../src/components/common/Card'
import { CardSkeleton } from '../../src/components/common/LoadingSkeleton'

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function NotificationsScreen() {
  const qc = useQueryClient()
  const resetUnread = useWsStore(s => s.resetUnread)

  const { data: notifications, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then(r => r.data),
    onSuccess: () => resetUnread(),
  } as any)

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); resetUnread() },
  })

  const unread = (notifications || []).filter((n: any) => !n.is_read).length

  const handleMarkAll = useCallback(() => {
    markAllRead.mutate()
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unread > 0 && <Text style={styles.sub}>{unread} unread</Text>}
        </View>
        {unread > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={notifications || []}
          keyExtractor={(n: any) => String(n.id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#4a5cff" />}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          renderItem={({ item: n }: { item: any }) => (
            <TouchableOpacity
              onPress={() => !n.is_read && markRead.mutate(n.id)}
              activeOpacity={n.is_read ? 1 : 0.7}
            >
              <Card style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}>
                <View style={styles.notifRow}>
                  <View style={[styles.notifDot, n.is_read && styles.notifDotRead]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifMsg, !n.is_read && styles.notifMsgUnread]}>
                      {n.message}
                    </Text>
                    <Text style={styles.notifTime}>{relTime(n.created_at)}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#1e1b4b' },
  sub: { fontSize: 13, color: '#9ca3af' },
  markAllBtn: { backgroundColor: '#eef0ff', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  markAllText: { color: '#4a5cff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 32 },
  notifCard: { padding: 14, marginBottom: 8 },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: '#4a5cff' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a5cff', marginTop: 5 },
  notifDotRead: { backgroundColor: '#e5e7eb' },
  notifMsg: { fontSize: 14, color: '#374151', lineHeight: 20 },
  notifMsgUnread: { fontWeight: '600', color: '#1e1b4b' },
  notifTime: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
})
