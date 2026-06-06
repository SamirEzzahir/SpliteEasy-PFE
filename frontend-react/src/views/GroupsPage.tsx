import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToastContext } from '../context/ToastContext'
import AddExpenseModal from '../components/AddExpenseModal'
import CreateGroupModal from '../components/CreateGroupModal'
import ManageMembersModal from '../components/ManageMembersModal'
import type { Group, GroupMember, MyFriend } from '../types'

const GROUP_TYPE_ICONS: Record<string, string> = {
  Home: 'bi-house-heart',
  Trip: 'bi-airplane',
  Couple: 'bi-hearts',
  Work: 'bi-briefcase',
  Personal: 'bi-person',
  Other: 'bi-collection',
}

export default function GroupsPage() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [groups, setGroups] = useState<Group[]>([])
  const [friends, setFriends] = useState<MyFriend[]>([])
  const [members, setMembers] = useState<Record<number, GroupMember[]>>({})
  const [balances, setBalances] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [manageGroup, setManageGroup] = useState<Group | null>(null)

  const load = async () => {
    try {
      const [{ data: gs }, { data: fr }] = await Promise.all([
        client.get<Group[]>('/groups/'),
        client.get<MyFriend[]>('/friends/my'),
      ])
      setGroups(gs)
      setFriends(fr)
      const results = await Promise.allSettled(
        gs.map(async (g) => {
          const [mRes, bRes] = await Promise.allSettled([
            client.get<GroupMember[]>(`/groups/${g.id}/members`),
            client.get<{ user_id: number; username: string; net: number }[]>(`/settle/${g.id}/balances`),
          ])
          const mems = mRes.status === 'fulfilled' ? mRes.value.data : []
          const bals = bRes.status === 'fulfilled' ? bRes.value.data : []
          const myBal = bals.find((b) => b.user_id === user?.id)?.net ?? 0
          return { id: g.id, mems, myBal }
        })
      )
      const newMembers: Record<number, GroupMember[]> = {}
      const newBalances: Record<number, number> = {}
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          newMembers[r.value.id] = r.value.mems
          newBalances[r.value.id] = r.value.myBal
        }
      })
      setMembers(newMembers)
      setBalances(newBalances)
    } catch {
      showToast('Failed to load groups', 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this group?')) return
    try {
      await client.delete(`/groups/${id}`)
      showToast('Group deleted', 'success')
      load()
    } catch {
      showToast('Failed to delete group', 'danger')
    }
  }

  const handleLeave = async (id: number) => {
    if (!confirm('Leave this group?')) return
    try {
      await client.post(`/groups/${id}/leave`)
      showToast('Left group', 'success')
      load()
    } catch {
      showToast('Failed to leave group', 'danger')
    }
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
        <div className="spinner-border" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-muted small">Groups</div>
          <h1 className="h4 mb-0">Your Groups</h1>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setShowExpense(true)}>
            <i className="bi bi-plus-lg" /> Add Expense
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="bi bi-people" /> New Group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card p-5 text-center">
          <i className="bi bi-people" style={{ fontSize: 48, opacity: 0.3 }} />
          <h3 className="mt-3">No groups yet</h3>
          <p className="text-muted">Create a group to start splitting expenses with others.</p>
          <div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Group</button>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {groups.map((g) => {
            const bal = balances[g.id] ?? 0
            const mems = members[g.id] ?? []
            const isOwner = g.owner_id === user?.id
            return (
              <div key={g.id} className="col-12 col-md-6">
                <div className="card p-3 h-100">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'linear-gradient(135deg, #4a5cff, #7c4dff)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20
                    }}>
                      <i className={`bi ${GROUP_TYPE_ICONS[g.type] ?? 'bi-collection'}`} />
                    </div>
                    <div>
                      <div className="fw-semibold">{g.title}</div>
                      <div className="text-muted small">{g.type}</div>
                    </div>
                  </div>

                  <div className="d-flex gap-3 mb-3">
                    <div>
                      <div className="text-muted small">Members</div>
                      <div className="fw-semibold">{mems.length || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted small">Currency</div>
                      <div className="fw-semibold">{g.currency}</div>
                    </div>
                    <div>
                      <div className="text-muted small">Your balance</div>
                      <div className={`fw-semibold ${bal > 0 ? 'text-success' : bal < 0 ? 'text-danger' : 'text-muted'}`}>
                        {bal === 0 ? 'Settled' : `${bal > 0 ? '+' : ''}${bal.toFixed(2)}`}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <a href={`/app/groups/${g.id}/expenses`} className="btn btn-sm btn-outline-secondary">
                      <i className="bi bi-list-ul" /> Expenses
                    </a>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setManageGroup(g)}>
                      <i className="bi bi-people" /> Members
                    </button>
                    {isOwner ? (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleLeave(g.id)}>
                        <i className="bi bi-box-arrow-left" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        friends={friends}
        onCreated={async () => { setShowCreate(false); await load() }}
        showToast={showToast}
      />

      <AddExpenseModal
        open={showExpense}
        groups={groups}
        onClose={() => setShowExpense(false)}
        onSuccess={() => { setShowExpense(false); showToast('Expense added', 'success') }}
      />

      <ManageMembersModal
        open={!!manageGroup}
        group={manageGroup}
        onClose={() => setManageGroup(null)}
        onUpdated={async () => { setManageGroup(null); await load() }}
        showToast={showToast}
      />
    </>
  )
}
