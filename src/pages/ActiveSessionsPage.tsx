import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchAllSessions,
  fetchDevices,
  fetchLoginHistory,
  fetchDashboardStats,
  revokeSession,
  revokeAllUserSessions,
  blockDevice,
  unblockDevice,
  renameDevice,
  type SessionInfo,
  type DeviceInfo,
  type LoginHistoryEntry,
  type DashboardStats,
} from '@/lib/session/sessionService'
import { useNavigate } from 'react-router-dom'

interface SessionWithProfile extends SessionInfo {
  profiles?: { username: string; role: string; site_id: string }
}

export function ActiveSessionsPage() {
  const { isMasterAdmin, user } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<SessionWithProfile[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Rename modal
  const [renameDeviceId, setRenameDeviceId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  // Confirm modals
  const [confirmRevokeSession, setConfirmRevokeSession] = useState<string | null>(null)
  const [confirmRevokeUser, setConfirmRevokeUser] = useState<string | null>(null)
  const [confirmBlockDevice, setConfirmBlockDevice] = useState<string | null>(null)

  if (!isMasterAdmin) {
    return (
      <PageLayout title="Active Sessions">
        <div className="p-6">
          <Card className="p-6 text-center">
            <span className="material-symbols-outlined text-outline text-4xl block mb-3">security</span>
            <h3 className="text-headline-md text-on-surface mb-2">Access Denied</h3>
            <p className="text-body-sm text-on-surface-variant">Only the Master Administrator can manage active sessions.</p>
          </Card>
        </div>
      </PageLayout>
    )
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d, st] = await Promise.all([
        fetchAllSessions(),
        fetchDevices(),
        fetchDashboardStats(),
      ])
      setSessions(s as SessionWithProfile[])
      setDevices(d)
      setStats(st)
    } catch (err) {
      console.error('[SESSIONS] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 15_000)
    return () => clearInterval(interval)
  }, [loadData])

  // Group sessions by user
  const groupedSessions = sessions.reduce((acc, s) => {
    const key = s.userId
    if (!acc[key]) acc[key] = { sessions: [], username: s.profiles?.username || 'Unknown', role: s.profiles?.role || '' }
    acc[key].sessions.push(s)
    return acc
  }, {} as Record<string, { sessions: SessionWithProfile[]; username: string; role: string }>)

  // Search/filter
  const filteredGroups = Object.entries(groupedSessions).filter(([_, group]) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!group.username.toLowerCase().includes(q)) return false
    }
    if (statusFilter !== 'all') {
      const hasMatching = group.sessions.some(s => s.status === statusFilter)
      if (!hasMatching) return false
    }
    return true
  })

  const getDeviceInfo = (deviceId: string): DeviceInfo | undefined =>
    devices.find(d => d.deviceId === deviceId)

  const handleRevokeSession = async (sessionId: string) => {
    if (!user?.id) return
    await revokeSession(sessionId, user.id)
    setConfirmRevokeSession(null)
    loadData()
  }

  const handleRevokeUser = async (userId: string) => {
    if (!user?.id) return
    await revokeAllUserSessions(userId, user.id)
    setConfirmRevokeUser(null)
    loadData()
  }

  const handleBlockDevice = async (deviceId: string) => {
    if (!user?.id) return
    await blockDevice(deviceId, user.id)
    setConfirmBlockDevice(null)
    loadData()
  }

  const handleUnblockDevice = async (deviceId: string) => {
    await unblockDevice(deviceId)
    loadData()
  }

  const handleRenameDevice = async () => {
    if (!renameDeviceId || !renameName.trim()) return
    await renameDevice(renameDeviceId, renameName.trim())
    setRenameDeviceId(null)
    setRenameName('')
    loadData()
  }

  return (
    <PageLayout title="Active Sessions">
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Active Accounts', value: stats.activeAccounts, color: '#56CCF2' },
              { label: 'Active Sessions', value: stats.activeSessions, color: '#2F80ED' },
              { label: 'Online', value: stats.onlineDevices, color: '#22c55e' },
              { label: 'Idle', value: stats.idleDevices, color: '#eab308' },
              { label: 'Offline', value: stats.offlineDevices, color: '#6b7280' },
              { label: 'Blocked', value: stats.blockedDevices, color: '#EF4444' },
              { label: "Today's Logins", value: stats.todayLogins, color: '#34D399' },
              { label: "Today's Failed", value: stats.todayFailedLogins, color: '#F2994A' },
            ].map(card => (
              <div key={card.label} className="bg-surface-container border border-outline-variant p-3 text-center">
                <p className="text-label-caps text-outline text-[9px]">{card.label}</p>
                <p className="text-data-mono text-xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search by username..."
            className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </select>
          <Button variant="secondary" icon="refresh" onClick={loadData}>Refresh</Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-body-sm text-outline">Loading sessions...</p>
          </div>
        )}

        {/* Session Groups */}
        {!loading && filteredGroups.length === 0 && (
          <div className="bg-surface-container border border-outline-variant p-12 text-center">
            <span className="material-symbols-outlined text-outline text-4xl block mb-3">devices</span>
            <h3 className="text-headline-md text-on-surface mb-2">No Active Sessions</h3>
            <p className="text-body-sm text-on-surface-variant">No sessions match your search criteria.</p>
          </div>
        )}

        {!loading && filteredGroups.map(([userId, group]) => {
          const isExpanded = expandedUserId === userId
          const activeCount = group.sessions.filter(s => s.status === 'online' || s.status === 'idle').length

          return (
            <div key={userId} className="bg-surface-container border border-outline-variant">
              {/* User header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => setExpandedUserId(isExpanded ? null : userId)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-sm">person</span>
                  </div>
                  <div>
                    <p className="text-label-caps text-on-surface">{group.username}</p>
                    <p className="text-data-mono text-[10px] text-outline">{group.role.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-data-mono text-[#56CCF2] text-xs font-bold">
                    {activeCount} Active Device{activeCount !== 1 ? 's' : ''}
                  </span>
                  <span className="material-symbols-outlined text-outline text-sm transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded sessions */}
              {isExpanded && (
                <div className="border-t border-outline-variant">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-data-mono text-[10px]">
                      <thead>
                        <tr className="border-b border-outline-variant/40 text-outline text-label-caps text-[9px]">
                          <th className="py-2 px-4">Device</th>
                          <th className="py-2 px-4">IP Address</th>
                          <th className="py-2 px-4">Browser</th>
                          <th className="py-2 px-4">OS</th>
                          <th className="py-2 px-4">Login Time</th>
                          <th className="py-2 px-4">Last Activity</th>
                          <th className="py-2 px-4">Status</th>
                          <th className="py-2 px-4">Current Page</th>
                          <th className="py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.sessions.map(session => {
                          const device = getDeviceInfo(session.deviceId)
                          const isOnline = session.status === 'online'
                          const isIdle = session.status === 'idle'
                          const statusColor = isOnline ? '#22c55e' : isIdle ? '#eab308' : '#6b7280'
                          const statusBg = isOnline ? '#22c55e/10' : isIdle ? '#eab308/10' : '#6b7280/10'

                          return (
                            <tr key={session.id} className="border-b border-outline-variant/20 hover:bg-surface-variant/20">
                              <td className="py-2.5 px-4">
                                <div>
                                  <p className="text-on-surface text-[11px] font-medium">{device?.deviceName || 'Unknown Device'}</p>
                                  <p className="text-outline text-[9px] mt-0.5">{session.deviceId.slice(0, 12)}...</p>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-on-surface-variant font-data-mono">
                                {session.ipAddress || '-'}
                              </td>
                              <td className="py-2.5 px-4 text-on-surface-variant">
                                {device?.browser || '-'} {device?.browserVersion || ''}
                              </td>
                              <td className="py-2.5 px-4 text-on-surface-variant">{device?.os || '-'}</td>
                              <td className="py-2.5 px-4 text-on-surface-variant">
                                {new Date(session.loginTime).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4 text-on-surface-variant">
                                {new Date(session.lastActivity).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border" style={{ borderColor: statusColor, color: statusColor }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                                  {session.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-on-surface-variant max-w-[120px] truncate">{session.currentPage}</td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-1">
                                  <button
                                    className="text-[#EF4444] hover:bg-[#EF4444]/10 p-1.5 rounded transition-colors"
                                    title="Force Logout"
                                    onClick={() => setConfirmRevokeSession(session.id)}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">logout</span>
                                  </button>
                                  {device && (
                                    <>
                                      <button
                                        className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
                                        title="Rename Device"
                                        onClick={() => { setRenameDeviceId(device.deviceId); setRenameName(device.deviceName) }}
                                      >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                      </button>
                                      {device.isBlocked ? (
                                        <button
                                          className="text-[#22c55e] hover:bg-[#22c55e]/10 p-1.5 rounded transition-colors"
                                          title="Unblock Device"
                                          onClick={() => handleUnblockDevice(device.deviceId)}
                                        >
                                          <span className="material-symbols-outlined text-[14px]">lock_open</span>
                                        </button>
                                      ) : (
                                        <button
                                          className="text-[#F2994A] hover:bg-[#F2994A]/10 p-1.5 rounded transition-colors"
                                          title="Block Device"
                                          onClick={() => { setConfirmBlockDevice(device.deviceId) }}
                                        >
                                          <span className="material-symbols-outlined text-[14px]">block</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* User-level actions */}
                  <div className="p-3 border-t border-outline-variant/30 flex justify-end gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      icon="logout"
                      onClick={() => setConfirmRevokeUser(userId)}
                    >
                      Force Logout All Sessions
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Confirmation Modals ── */}
      {confirmRevokeSession && (
        <Modal isOpen={true} onClose={() => setConfirmRevokeSession(null)} title="Force Logout Session" size="sm">
          <div className="space-y-4">
            <p className="text-body-sm text-on-surface-variant">Are you sure you want to force logout this session? The user will be disconnected immediately.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmRevokeSession(null)}>Cancel</Button>
              <Button variant="danger" icon="logout" onClick={() => handleRevokeSession(confirmRevokeSession)}>Force Logout</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmRevokeUser && (
        <Modal isOpen={true} onClose={() => setConfirmRevokeUser(null)} title="Force Logout All Sessions" size="sm">
          <div className="space-y-4">
            <p className="text-body-sm text-on-surface-variant">Are you sure you want to force logout ALL sessions for this account? The user will be disconnected from every device.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmRevokeUser(null)}>Cancel</Button>
              <Button variant="danger" icon="logout" onClick={() => handleRevokeUser(confirmRevokeUser)}>Logout All</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmBlockDevice && (
        <Modal isOpen={true} onClose={() => setConfirmBlockDevice(null)} title="Block Device" size="sm">
          <div className="space-y-4">
            <p className="text-body-sm text-on-surface-variant">Are you sure you want to block this device? The user will be disconnected and this device will not be able to authenticate again, even with the correct credentials.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmBlockDevice(null)}>Cancel</Button>
              <Button variant="danger" icon="block" onClick={() => handleBlockDevice(confirmBlockDevice)}>Block Device</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Rename Device Modal ── */}
      {renameDeviceId && (
        <Modal isOpen={true} onClose={() => setRenameDeviceId(null)} title="Rename Device" size="sm">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-label-caps text-on-surface-variant">Device Name</label>
              <input
                type="text"
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="e.g. Operations Room PC"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRenameDeviceId(null)}>Cancel</Button>
              <Button variant="primary" icon="save" onClick={handleRenameDevice}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}
