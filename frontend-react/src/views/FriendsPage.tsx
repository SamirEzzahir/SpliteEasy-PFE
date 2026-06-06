import { useEffect, useState } from 'react'
import client from '../api/client'
import { useToastContext } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

interface FriendEntry {
  friendship_id: number
  user_id: number
  username: string
  email: string
  phone?: string
}

interface ReceivedRequest {
  id: number
  user_id?: number
  user_username?: string
  user_email: string
}

interface SentRequest {
  id: number
  friend_id?: number
  friend_username?: string
  friend_email: string
}

interface Balance {
  user_id: number
  username: string
  net: number
}

type Tab = 'friends' | 'received' | 'sent'

function Avatar({ name }: { name: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: 'linear-gradient(135deg, #4a5cff, #7c4dff)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: 16
    }}>
      {name[0].toUpperCase()}
    </div>
  )
}

export default function FriendsPage() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [received, setReceived] = useState<ReceivedRequest[]>([])
  const [sent, setSent] = useState<SentRequest[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; email: string }[]>([])
  const [searching, setSearching] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [fr, rec, snt, bal] = await Promise.allSettled([
        client.get<FriendEntry[]>('/friends/my'),
        client.get<ReceivedRequest[]>('/friends/requests/received'),
        client.get<SentRequest[]>('/friends/requests/sent'),
        client.get<Balance[]>('/settle/global/balances'),
      ])
      if (fr.status === 'fulfilled') setFriends(fr.value.data)
      if (rec.status === 'fulfilled') setReceived(rec.value.data)
      if (snt.status === 'fulfilled') setSent(snt.value.data)
      if (bal.status === 'fulfilled') setBalances(bal.value.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const { data } = await client.get(`/friends/search?query=${encodeURIComponent(searchQuery)}`)
      setSearchResults(data)
    } catch {
      showToast('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleSendRequest = async (friendId: number) => {
    try {
      await client.post(`/friends/request/${friendId}`)
      showToast('Friend request sent')
      setSearchResults([])
      setSearchQuery('')
      load()
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to send request')
    }
  }

  const handleAccept = async (requestId: number) => {
    try {
      await client.post(`/friends/request/${requestId}/accept`)
      showToast('Friend request accepted')
      load()
    } catch {
      showToast('Failed to accept request')
    }
  }

  const handleReject = async (requestId: number) => {
    try {
      await client.post(`/friends/request/${requestId}/reject`)
      showToast('Request rejected')
      load()
    } catch {
      showToast('Failed to reject request')
    }
  }

  const handleRemove = async (friendshipId: number) => {
    if (!confirm('Remove this friend?')) return
    try {
      await client.delete(`/friends/remove/${friendshipId}`)
      showToast('Friend removed')
      load()
    } catch {
      showToast('Failed to remove friend')
    }
  }

  const getBalance = (userId: number) => balances.find((b) => b.user_id === userId)?.net ?? 0

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
        <div className="spinner-border" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'linear-gradient(135deg,#4a5cff,#7c4dff)' : 'transparent',
    color: active ? '#fff' : 'rgba(11,16,32,0.68)',
    border: '1px solid',
    borderColor: active ? 'transparent' : 'rgba(15,23,42,0.12)',
    borderRadius: 10,
    padding: '0.4rem 0.9rem',
    fontWeight: 650,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  })

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem 1rem',
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-muted small">Friends</div>
          <h1 className="h4 mb-0">Manage your connections</h1>
        </div>
      </div>

      {/* Add friend search */}
      <div className="card p-3 mb-3">
        <div className="fw-semibold mb-2">Add Friend</div>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            placeholder="Search by username or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={searching} style={{ flexShrink: 0 }}>
            {searching ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}
          </button>
        </div>
        {searchResults.filter((r) => r.id !== user?.id).length > 0 && (
          <div className="card mt-2" style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}>
            {searchResults.filter((r) => r.id !== user?.id).map((r, idx, arr) => (
              <div
                key={r.id}
                className="d-flex align-items-center justify-content-between px-3 py-2"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(15,23,42,0.07)' : undefined }}
              >
                <span>
                  <strong>{r.username}</strong>{' '}
                  <span className="text-muted small">{r.email}</span>
                </span>
                <button className="btn btn-sm btn-primary" onClick={() => handleSendRequest(r.id)}>
                  <i className="bi bi-person-plus" /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="d-flex gap-2 mb-3">
        <button style={tabStyle(tab === 'friends')} onClick={() => setTab('friends')}>
          <i className="bi bi-people" /> Friends
          <span className="badge text-bg-primary ms-1">{friends.length}</span>
        </button>
        <button style={tabStyle(tab === 'received')} onClick={() => setTab('received')}>
          <i className="bi bi-person-plus" /> Requests
          {received.length > 0 && <span className="badge text-bg-danger ms-1">{received.length}</span>}
        </button>
        <button style={tabStyle(tab === 'sent')} onClick={() => setTab('sent')}>
          <i className="bi bi-send" /> Sent
          {sent.length > 0 && <span className="badge text-bg-primary ms-1">{sent.length}</span>}
        </button>
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        <div className="card">
          {friends.length === 0 ? (
            <div className="p-5 text-center">
              <i className="bi bi-people" style={{ fontSize: 40, opacity: 0.3 }} />
              <p className="text-muted mt-2">No friends yet. Search above to add one.</p>
            </div>
          ) : (
            friends.map((f, idx) => {
              const bal = getBalance(f.user_id)
              return (
                <div
                  key={f.friendship_id}
                  style={{ ...rowStyle, borderBottom: idx < friends.length - 1 ? '1px solid rgba(15,23,42,0.07)' : undefined }}
                >
                  <Avatar name={f.username} />
                  <div className="flex-grow-1 overflow-hidden">
                    <div className="fw-semibold">{f.username}</div>
                    <div className="text-muted small text-truncate">{f.email}</div>
                  </div>
                  <div style={{
                    fontWeight: 650,
                    color: bal > 0 ? 'var(--success)' : bal < 0 ? 'var(--danger)' : 'var(--muted)',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                  }}>
                    {bal === 0 ? 'Settled' : bal > 0 ? `They owe ${bal.toFixed(2)}` : `You owe ${Math.abs(bal).toFixed(2)}`}
                  </div>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemove(f.friendship_id)}>
                    <i className="bi bi-person-dash" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Received requests */}
      {tab === 'received' && (
        <div className="card">
          {received.length === 0 ? (
            <div className="p-4 text-center text-muted">No pending requests.</div>
          ) : (
            received.map((r, idx) => (
              <div
                key={r.id}
                style={{ ...rowStyle, borderBottom: idx < received.length - 1 ? '1px solid rgba(15,23,42,0.07)' : undefined }}
              >
                <Avatar name={r.user_username ?? r.user_email} />
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fw-semibold">{r.user_username ?? '—'}</div>
                  <div className="text-muted small text-truncate">{r.user_email}</div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleReject(r.id)}>Decline</button>
                  <button className="btn btn-sm btn-primary" onClick={() => handleAccept(r.id)}>Accept</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sent requests */}
      {tab === 'sent' && (
        <div className="card">
          {sent.length === 0 ? (
            <div className="p-4 text-center text-muted">No pending sent requests.</div>
          ) : (
            sent.map((r, idx) => (
              <div
                key={r.id}
                style={{ ...rowStyle, borderBottom: idx < sent.length - 1 ? '1px solid rgba(15,23,42,0.07)' : undefined }}
              >
                <Avatar name={r.friend_username ?? r.friend_email} />
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fw-semibold">{r.friend_username ?? '—'}</div>
                  <div className="text-muted small text-truncate">{r.friend_email}</div>
                </div>
                <span className="badge text-bg-warning">Pending</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
