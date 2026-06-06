import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

type GroupInfo = {
  id: number
  title: string
  type: string
  currency: string
  member_count: number
  already_member: boolean
}

export default function JoinGroupPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (!groupId) { setError('Invalid invitation link.'); setLoading(false); return }
    client.get<GroupInfo>(`/groups/join/${groupId}/info`)
      .then(res => setInfo(res.data))
      .catch(e => setError(String(e?.response?.data?.detail || 'Invalid or expired invitation link.')))
      .finally(() => setLoading(false))
  }, [groupId])

  async function join() {
    if (!groupId) return
    setJoining(true)
    try {
      await client.post(`/groups/join/${groupId}`)
      setJoined(true)
    } catch (e: any) {
      setError(String(e?.response?.data?.detail || 'Failed to join group.'))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0f2ff,#f8f0ff)', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: 40, maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(74,92,255,.12)', textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
          background: 'linear-gradient(135deg,#4a5cff,#7c4dff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="bi bi-people-fill text-white" style={{ fontSize: 32 }}></i>
        </div>

        {loading ? (
          <>
            <div className="spinner-border text-primary" style={{ width: 40, height: 40 }}></div>
            <p className="text-muted mt-3">Loading group info…</p>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h4 style={{ fontWeight: 700, marginBottom: 8 }}>Invalid Link</h4>
            <p className="text-muted" style={{ fontSize: 14 }}>{error}</p>
            <button className="btn btn-primary mt-3" style={{ borderRadius: 12, padding: '10px 28px' }}
              onClick={() => navigate('/app/groups')}>
              Go to Groups
            </button>
          </>
        ) : joined ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#35c89320',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <i className="bi bi-check-lg" style={{ color: '#35c893', fontSize: 32 }}></i>
            </div>
            <h4 style={{ fontWeight: 700, marginBottom: 8 }}>You're in! 🎉</h4>
            <p className="text-muted" style={{ fontSize: 14 }}>
              You've successfully joined <strong>{info?.title}</strong>.
            </p>
            <button className="btn btn-primary mt-3 w-100" style={{ borderRadius: 12, padding: '12px' }}
              onClick={() => navigate(`/app/groups/${info?.id}/expenses`)}>
              <i className="bi bi-arrow-right me-2"></i>Open Group
            </button>
          </>
        ) : info?.already_member ? (
          <>
            <h4 style={{ fontWeight: 700, marginBottom: 8 }}>Already a member</h4>
            <p className="text-muted" style={{ fontSize: 14 }}>
              You're already in <strong>{info.title}</strong>.
            </p>
            <button className="btn btn-primary mt-3 w-100" style={{ borderRadius: 12, padding: '12px' }}
              onClick={() => navigate(`/app/groups/${info.id}/expenses`)}>
              <i className="bi bi-arrow-right me-2"></i>Open Group
            </button>
          </>
        ) : info ? (
          <>
            <h4 style={{ fontWeight: 700, marginBottom: 4 }}>You're invited!</h4>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 24 }}>
              Join the group and start splitting expenses together.
            </p>

            <div style={{
              padding: '16px 20px', borderRadius: 16,
              background: '#f8f9ff', border: '1px solid #e8eaff', marginBottom: 24, textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg,#4a5cff,#7c4dff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="bi bi-people-fill text-white" style={{ fontSize: 22 }}></i>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{info.title}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {info.type} · {info.member_count} members · {info.currency}
                  </div>
                </div>
              </div>
            </div>

            <button className="btn btn-primary w-100 fw-semibold" disabled={joining}
              onClick={join}
              style={{
                borderRadius: 14, padding: '13px',
                background: 'linear-gradient(135deg,#4a5cff,#7c4dff)',
                border: 'none', fontSize: 15,
              }}>
              {joining
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Joining…</>
                : <><i className="bi bi-person-plus me-2"></i>Join Group</>}
            </button>

            <button className="btn btn-link text-muted mt-2 w-100" style={{ fontSize: 13 }}
              onClick={() => navigate('/app/groups')}>
              Maybe later
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
