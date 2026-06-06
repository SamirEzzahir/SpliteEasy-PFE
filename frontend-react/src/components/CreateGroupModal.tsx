import { useMemo, useRef, useState, type FormEvent } from 'react'
import client from '../api/client'
import type { MyFriend } from '../types'
import BodyPortal from './BodyPortal'

type SplitDefault = 'equal' | 'percentage' | 'share'
type ToastType = 'success' | 'danger' | 'info' | 'warning' | 'primary'

const groupTypes = [
  { value: 'Trip', label: 'Trip', icon: 'bi-briefcase-fill' },
  { value: 'Home', label: 'Home', icon: 'bi-house-fill' },
  { value: 'Couple', label: 'Couple', icon: 'bi-heart-fill' },
  { value: 'Work', label: 'Work', icon: 'bi-building-fill' },
  { value: 'Other', label: 'Other', icon: 'bi-people-fill' },
] as const

const currencies = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'MAD', label: 'MAD - Moroccan Dirham' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
] as const

const splitOptions = [
  {
    value: 'equal',
    icon: 'bi-people-fill',
    title: 'Equal Split',
    text: 'Split expenses equally among all members',
  },
  {
    value: 'percentage',
    icon: 'bi-percent',
    title: 'By Percentage',
    text: 'Split expenses by custom percentages',
  },
  {
    value: 'share',
    icon: 'bi-person-fill',
    title: 'By Share',
    text: 'Split expenses by custom shares',
  },
] as const

export default function CreateGroupModal({
  open,
  onClose,
  friends,
  onCreated,
  showToast,
}: {
  open: boolean
  onClose: () => void
  friends: MyFriend[]
  onCreated: () => Promise<void>
  showToast: (message: string, type?: ToastType) => void
}) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<(typeof groupTypes)[number]['value']>('Trip')
  const [currency, setCurrency] = useState('USD')
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [splitDefault, setSplitDefault] = useState<SplitDefault>('equal')
  const [anyoneCanAdd, setAnyoneCanAdd] = useState(true)
  const [photo, setPhoto] = useState<string | null>(null)

  const imageRef = useRef<HTMLInputElement | null>(null)

  const selectedType = groupTypes.find((item) => item.value === type) || groupTypes[0]

  const filteredFriends = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return friends
    return friends.filter((friend) => {
      return friend.username.toLowerCase().includes(query) || friend.email.toLowerCase().includes(query)
    })
  }, [friends, memberSearch])

  function reset() {
    setCreating(false)
    setTitle('')
    setDescription('')
    setType('Trip')
    setCurrency('USD')
    setMemberIds([])
    setMemberSearch('')
    setSplitDefault('equal')
    setAnyoneCanAdd(true)
    setPhoto(null)
    if (imageRef.current) imageRef.current.value = ''
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) {
      showToast('Group name is required', 'danger')
      return
    }

    setCreating(true)
    try {
      await client.post('/groups', {
        title: title.trim(),
        type,
        currency,
        photo: photo || undefined,
        member_ids: memberIds,
      })
      showToast('Group created successfully', 'success')
      reset()
      onClose()
      await onCreated()
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to create group'
      showToast(String(message), 'danger')
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <BodyPortal>
      <div
        className="modal fade show d-block create-group-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !creating) {
            reset()
            onClose()
          }
        }}
        style={{ background: 'rgba(7,10,20,0.52)', backdropFilter: 'blur(3px)' }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content create-group-shell">
            <button
              className="create-group-close"
              type="button"
              aria-label="Close"
              onClick={() => {
                if (creating) return
                reset()
                onClose()
              }}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            <div className="create-group-header">
              <span className="create-group-mark">
                <i className="bi bi-people-fill"></i>
              </span>
              <div>
                <h2>Create New Group</h2>
                <p>Add group details and invite members</p>
              </div>
            </div>

            <form className="create-group-form" onSubmit={submit}>
              <div className="create-group-grid two">
                <label className="create-group-field">
                  <span>Group Name</span>
                  <div className="create-group-input">
                    <i className="bi bi-people"></i>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekend Trip to Dubai" required />
                  </div>
                </label>

                <label className="create-group-field">
                  <span>Group Type</span>
                  <div className="create-group-input">
                    <i className={`bi ${selectedType.icon}`}></i>
                    <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                      {groupTypes.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              <label className="create-group-field">
                <span>Description <small>(Optional)</small></span>
                <div className="create-group-textarea">
                  <i className="bi bi-chat-left-text"></i>
                  <textarea
                    maxLength={200}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Trip to Dubai with close friends for a weekend getaway."
                  />
                  <b>{description.length}/200</b>
                </div>
              </label>

              <div className="create-group-grid two">
                <label className="create-group-field">
                  <span>Currency</span>
                  <div className="create-group-input">
                    <i className="bi bi-currency-dollar"></i>
                    <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                      {currencies.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="create-group-field">
                  <span>Group Image <small>(Optional)</small></span>
                  <button className="group-upload" type="button" onClick={() => imageRef.current?.click()}>
                    {photo ? (
                      <img src={photo} alt="" />
                    ) : (
                      <>
                        <i className="bi bi-image"></i>
                        <span>
                          Click to upload or drag and drop
                          <small>PNG, JPG up to 2MB</small>
                        </span>
                      </>
                    )}
                  </button>
                  <input
                    ref={imageRef}
                    className="d-none"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) {
                        showToast('Image must be 2MB or smaller', 'warning')
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => setPhoto(String(reader.result || ''))
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              </div>

              <label className="create-group-field">
                <span>Add Members</span>
                <div className="create-member-search">
                  <i className="bi bi-search"></i>
                  <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search by name or email..." />
                </div>
              </label>

              <div className="create-member-chips">
                {memberIds.map((id) => {
                  const friend = friends.find((item) => item.user_id === id)
                  if (!friend) return null
                  return (
                    <span className="create-member-chip" key={id}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.username)}`} alt="" />
                      {friend.username}
                      <button type="button" onClick={() => setMemberIds((current) => current.filter((memberId) => memberId !== id))}>
                        <i className="bi bi-x"></i>
                      </button>
                    </span>
                  )
                })}
              </div>

              {memberSearch ? (
                <div className="create-member-results">
                  {filteredFriends.length ? (
                    filteredFriends.slice(0, 6).map((friend) => {
                      const selected = memberIds.includes(friend.user_id)
                      return (
                        <button
                          type="button"
                          className={`create-member-result ${selected ? 'selected' : ''}`}
                          key={friend.user_id}
                          onClick={() =>
                            setMemberIds((current) =>
                              selected ? current.filter((id) => id !== friend.user_id) : [...current, friend.user_id],
                            )
                          }
                        >
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.username)}`} alt="" />
                          <span>
                            <strong>{friend.username}</strong>
                            <small>{friend.email}</small>
                          </span>
                          <i className={`bi ${selected ? 'bi-check-circle-fill' : 'bi-plus-circle'}`}></i>
                        </button>
                      )
                    })
                  ) : (
                    <p>No matching friends found.</p>
                  )}
                </div>
              ) : null}

              <div className="create-group-field">
                <span>Default Expense Split</span>
                <div className="split-option-grid">
                  {splitOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`split-option ${splitDefault === option.value ? 'active' : ''}`}
                      onClick={() => setSplitDefault(option.value)}
                    >
                      <span><i className={`bi ${option.icon}`}></i></span>
                      <strong>{option.title}</strong>
                      <small>{option.text}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="group-toggle-row">
                <span>
                  <strong>Anyone can add expenses</strong>
                  <small>Allow all group members to add expenses</small>
                </span>
                <input type="checkbox" role="switch" checked={anyoneCanAdd} onChange={(event) => setAnyoneCanAdd(event.target.checked)} />
              </label>

              <div className="create-group-footer">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={creating}
                  onClick={() => {
                    reset()
                    onClose()
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person-plus"></i>
                      Create Group
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </BodyPortal>
  )
}
