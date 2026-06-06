import { useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Group, GroupMember, MyFriend } from '../types/index'
import BodyPortal from './BodyPortal'

type ToastType = 'success' | 'danger' | 'info' | 'warning' | 'primary'

type BalanceItem = {
  user_id: number
  username: string
  net: number
}

function initials(name?: string) {
  const clean = (name || 'U').trim()
  if (!clean) return 'U'
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function avatarFor(name: string, photo?: string) {
  if (photo) return photo
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'SplitEasy')}`
}

function money(value: number, currency = 'USD') {
  return `${Math.abs(Number(value) || 0).toFixed(2)} ${currency}`
}

function dateLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ManageMembersModal({
  open,
  group,
  onClose,
  onUpdated,
  showToast,
}: {
  open: boolean
  group: Group | null
  onClose: () => void
  onUpdated: () => Promise<void>
  showToast: (message: string, type?: ToastType) => void
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [friends, setFriends] = useState<MyFriend[]>([])
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || !group) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  async function load() {
    if (!group) return
    setLoading(true)
    try {
      const [memberRes, friendRes, balanceRes] = await Promise.all([
        client.get<GroupMember[]>(`/groups/${group.id}/members`),
        client.get<MyFriend[]>('/friends/my').catch(() => ({ data: [] as MyFriend[] })),
        client.get<BalanceItem[]>(`/settle/${group.id}/balances`).catch(() => ({ data: [] as BalanceItem[] })),
      ])
      setMembers(memberRes.data || [])
      setFriends(friendRes.data || [])
      setBalances(balanceRes.data || [])
      setSelectedIds([])
      setQuery('')
      setMakeAdmin(false)
      setOpenMenuId(null)
    } catch (error: any) {
      showToast(String(error?.response?.data?.detail || 'Failed to load members'), 'danger')
    } finally {
      setLoading(false)
    }
  }

  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members])

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return friends
      .filter((friend) => !memberIds.has(friend.user_id))
      .filter((friend) => !q || friend.username.toLowerCase().includes(q) || friend.email.toLowerCase().includes(q))
  }, [friends, memberIds, query])

  const balanceByUser = useMemo(() => {
    const map = new Map<number, number>()
    balances.forEach((balance) => map.set(balance.user_id, Number(balance.net || 0)))
    return map
  }, [balances])

  async function addSelectedMembers() {
    if (!group || selectedIds.length === 0) return
    setSaving('add')
    try {
      await client.post(`/groups/${group.id}/add_members`, { user_ids: selectedIds, is_admin: makeAdmin })
      showToast(`${selectedIds.length} member${selectedIds.length > 1 ? 's' : ''} added`, 'success')
      await load()
      await onUpdated()
    } catch (error: any) {
      showToast(String(error?.response?.data?.detail || 'Failed to add members'), 'danger')
    } finally {
      setSaving(null)
    }
  }

  async function toggleAdmin(member: GroupMember, becomeAdmin: boolean) {
    if (!group) return
    setOpenMenuId(null)
    setSaving(`admin-${member.user_id}`)
    try {
      await client.put(`/groups/${group.id}/members/${member.user_id}`, { is_admin: becomeAdmin })
      showToast(becomeAdmin ? 'Promoted to admin' : 'Admin rights removed', 'success')
      await load()
      await onUpdated()
    } catch (error: any) {
      showToast(String(error?.response?.data?.detail || 'Failed to update role'), 'danger')
    } finally {
      setSaving(null)
    }
  }

  async function removeMember(member: GroupMember) {
    if (!group) return
    setOpenMenuId(null)

    if (member.is_admin) {
      setSaving(`admin-${member.user_id}`)
      try {
        await client.put(`/groups/${group.id}/members/${member.user_id}`, { is_admin: false })
      } catch (error: any) {
        showToast(String(error?.response?.data?.detail || 'Could not demote admin'), 'danger')
        setSaving(null)
        return
      }
    }

    setSaving(`remove-${member.user_id}`)
    try {
      await client.delete(`/groups/${group.id}/members/${member.user_id}`)
      showToast('Member removed', 'warning')
      await load()
      await onUpdated()
    } catch (error: any) {
      showToast(String(error?.response?.data?.detail || 'Failed to remove member'), 'danger')
    } finally {
      setSaving(null)
    }
  }

  const invitationLink = group ? `${window.location.origin}/join/${group.id}` : ''

  async function copyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
      showToast('Invitation link copied!', 'success')
    } catch {
      showToast(invitationLink, 'info')
    }
  }

  if (!open || !group) return null

  return (
    <BodyPortal>
      <div
        className="modal manage-members-modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content manage-members-shell">
            <button className="manage-members-close" type="button" aria-label="Close" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>

            <header className="manage-members-header">
              <span className="manage-members-mark">
                <i className="bi bi-people"></i>
              </span>
              <div>
                <h2>Manage Members</h2>
                <p>Add, remove or update members in this group.</p>
              </div>
            </header>

            <section className="manage-members-group">
              <span>
                <i className="bi bi-people-fill"></i>
              </span>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h3>{group.title}</h3>
                  <b>Group</b>
                </div>
                <p>
                  {members.length} members
                  {group.created_at ? ` • Created ${dateLabel(group.created_at)}` : ''}
                </p>
              </div>
            </section>

            <div className="manage-members-body">
              <section className="manage-add-panel">
                <h3>Add New Members</h3>
                <p>Search and select friends to add to this group.</p>

                <label className="member-search-box">
                  <i className="bi bi-search"></i>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" />
                </label>

                <div className="member-candidate-list">
                  {loading ? (
                    <div className="member-empty">Loading members...</div>
                  ) : candidates.length > 0 ? (
                    candidates.slice(0, 10).map((friend) => {
                      const selected = selectedIds.includes(friend.user_id)
                      return (
                        <button
                          className={`member-candidate ${selected ? 'selected' : ''}`}
                          key={friend.user_id}
                          type="button"
                          onClick={() => {
                            setSelectedIds((current) =>
                              selected ? current.filter((id) => id !== friend.user_id) : [...current, friend.user_id],
                            )
                          }}
                        >
                          <span>{initials(friend.username)}</span>
                          <strong>{friend.username}</strong>
                          <small>{friend.email}</small>
                          <i className={`bi ${selected ? 'bi-check-square-fill' : 'bi-square'}`}></i>
                        </button>
                      )
                    })
                  ) : (
                    <div className="member-empty">No friends available to add.</div>
                  )}
                </div>

                <label className="make-admin-row">
                  <span>
                    <i className="bi bi-crown"></i>
                  </span>
                  <strong>Make Admin</strong>
                  <small>Assign admin rights to selected members.</small>
                  <input type="checkbox" checked={makeAdmin} onChange={(event) => setMakeAdmin(event.target.checked)} />
                </label>

                <button
                  className="btn btn-primary member-add-button"
                  type="button"
                  disabled={selectedIds.length === 0 || saving === 'add'}
                  onClick={addSelectedMembers}
                >
                  {saving === 'add' ? (
                    <>
                      <span className="spinner-border spinner-border-sm"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person-plus"></i>
                      Add {selectedIds.length} Member{selectedIds.length === 1 ? '' : 's'}
                    </>
                  )}
                </button>
              </section>

              <section className="current-members-panel">
                <div className="current-members-heading">
                  <div>
                    <h3>Current Members ({members.length})</h3>
                    <p>Manage group members and their permissions.</p>
                  </div>
                  <button className="btn btn-outline-primary" type="button" onClick={() => setQuery('')}>
                    <i className="bi bi-person-plus"></i>
                    Invite Member
                  </button>
                </div>

                <div className="current-member-list" ref={menuRef}>
                  {loading ? (
                    <div className="member-empty">Loading current members...</div>
                  ) : members.length === 0 ? (
                    <div className="member-empty">No members found.</div>
                  ) : (
                    members.map((member) => {
                      const isMe = member.user_id === user?.id
                      const isOwner = member.user_id === group.owner_id
                      const isAdmin = !!member.is_admin
                      const balance = balanceByUser.get(member.user_id) || 0
                      const isPositive = balance >= 0
                      const actionKey = `remove-${member.user_id}`
                      const adminKey = `admin-${member.user_id}`
                      const busy = saving === actionKey || saving === adminKey

                      return (
                        <div className="current-member-row" key={member.user_id}>
                          <img src={avatarFor(member.username, member.profile_photo)} alt="" />

                          <div>
                            <strong>
                              {member.username}
                              {isMe ? ' (You)' : ''}
                            </strong>
                            <small>{member.email || `${member.username.toLowerCase()}@mail.com`}</small>
                          </div>

                          <span className={`member-role ${isAdmin ? 'admin' : ''}`}>
                            {isAdmin ? <i className="bi bi-crown-fill"></i> : null}
                            {isAdmin ? 'Admin' : 'Member'}
                          </span>

                          <div className="member-balance">
                            <strong>{money(balance, group.currency)}</strong>
                            <small className={isPositive ? 'paid' : 'owes'}>{isPositive ? 'You paid' : 'Owes you'}</small>
                          </div>

                          <button
                            className="member-icon-action"
                            type="button"
                            title={isAdmin ? 'Remove admin rights' : 'Make admin'}
                            disabled={busy || isOwner}
                            onClick={() => toggleAdmin(member, !isAdmin)}
                          >
                            {saving === adminKey ? (
                              <span className="spinner-border spinner-border-sm"></span>
                            ) : (
                              <i className={`bi ${isAdmin ? 'bi-shield-fill-check' : 'bi-shield'}`}></i>
                            )}
                          </button>

                          {!isOwner && !isMe ? (
                            <div className="member-actions-wrap">
                              <button
                                className="member-icon-action"
                                type="button"
                                disabled={busy}
                                onClick={() => setOpenMenuId((current) => (current === member.user_id ? null : member.user_id))}
                              >
                                {saving === actionKey ? (
                                  <span className="spinner-border spinner-border-sm"></span>
                                ) : (
                                  <i className="bi bi-three-dots-vertical"></i>
                                )}
                              </button>

                              {openMenuId === member.user_id ? (
                                <div className="member-action-menu">
                                  <button type="button" onClick={() => toggleAdmin(member, !isAdmin)}>
                                    <i className={`bi ${isAdmin ? 'bi-shield-x' : 'bi-shield-check'}`}></i>
                                    {isAdmin ? 'Remove Admin' : 'Make Admin'}
                                  </button>
                                  <button
                                    className="danger"
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Remove ${member.username} from ${group.title}?`)) removeMember(member)
                                    }}
                                  >
                                    <i className="bi bi-person-x"></i>
                                    Remove from group
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span></span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="invitation-link-box">
                  <span>
                    <i className="bi bi-link-45deg"></i>
                  </span>
                  <div>
                    <strong>Group Invitation Link</strong>
                    <small>Anyone with this link can request to join the group.</small>
                  </div>
                  <button className={`btn btn-light ${linkCopied ? 'active' : ''}`} type="button" onClick={copyInvitationLink}>
                    <i className={`bi ${linkCopied ? 'bi-check-lg' : 'bi-link-45deg'}`}></i>
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <div className="invitation-url">
                    <strong>{invitationLink}</strong>
                    <button type="button" onClick={copyInvitationLink}>
                      <i className="bi bi-upload"></i>
                      Share Link
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="members-tip-box">
              <span>
                <i className="bi bi-shield"></i>
              </span>
              <div>
                <strong>Tip</strong>
                <small>Admins can add or remove members, update roles, and manage group permissions.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  )
}
