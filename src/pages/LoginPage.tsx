import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { DEMO_USERS, isDemoMode } from '@/utils/demoMode'

/** Demo credentials shown for quick login in development */
const DEMO_CREDENTIALS = [
  { username: 'masterofeyes', label: 'Master Admin', color: '#EF4444' },
  { username: '815avenger', label: 'Admin - SITE-01', color: '#F2994A' },
  { username: '817avenger', label: 'Admin - SITE-02', color: '#F2994A' },
  { username: '821avenger', label: 'Admin - SITE-03', color: '#F2994A' },
  { username: '586pechora', label: 'Admin - SITE-04', color: '#F2994A' },
  { username: 'HARES', label: 'Admin - SITE-05', color: '#F2994A' },
]

export function LoginPage() {
  const { signIn, error, loading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const from = (location.state as any)?.from?.pathname || '/dashboard'
  const isDemo = isDemoMode()

  useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true })
    }
  }, [user, loading, navigate, from])

  /** Explicit submit — only triggered by button click or Enter on password field */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!username.trim()) { setLocalError('Username is required.'); return }
    if (!password) { setLocalError('Access key is required.'); return }
    if (submitting) return
    setSubmitting(true)
    try {
      await signIn(username.trim(), password)
      navigate(from, { replace: true })
    } catch {
      // Error is set in context
    } finally {
      setSubmitting(false)
    }
  }

  /** Prevent Enter key on username from triggering form submission */
  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Focus the password field instead
      const pw = document.getElementById('password')
      pw?.focus()
    }
  }

  const fillDemo = (idx: number) => {
    setUsername(DEMO_CREDENTIALS[idx].username)
    setPassword('demo123')
  }

  return (
    <>
      {/* Tactical Header */}
      <div className="flex flex-col items-center mb-6 sm:mb-10">
        <div className="w-14 h-14 sm:w-16 sm:h-16 border border-outline-variant flex items-center justify-center mb-4 sm:mb-6 bg-surface-container-low">
          <span className="material-symbols-outlined text-primary text-[28px] sm:text-[32px]">precision_manufacturing</span>
        </div>
        <div className="text-center space-y-1">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
            Drone Airshow Command Center
          </h1>
          <p className="font-label-caps text-label-caps text-outline uppercase">
            Authorized Personnel Only // Security Level 4
          </p>
        </div>
      </div>

      {/* Login Form Card */}
      <div className="bg-surface-container border border-outline-variant p-6 sm:p-8 shadow-2xl">
        <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
          {/* Demo Mode Notice */}
          {isDemo && (
            <div className="bg-[#2F80ED]/10 border border-[#2F80ED]/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-sm">info</span>
                <span className="text-label-caps text-primary">DEMO MODE</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {DEMO_CREDENTIALS.map((c, i) => (
                  <button
                    key={c.username}
                    type="button"
                    className="text-left px-3 py-2 border border-outline-variant hover:bg-surface-container-high transition-colors text-body-sm text-on-surface flex items-center justify-between"
                    onClick={() => fillDemo(i)}
                  >
                    <span className="font-medium">{c.username}</span>
                    <span className="text-label-caps uppercase font-bold" style={{ color: c.color }}>{c.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-body-sm text-on-surface-variant mt-2">
                Select an account, or enter any username + password.
              </p>
            </div>
          )}

          {/* Username Field */}
          <div className="space-y-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between" htmlFor="username">
              <span>Username</span>
              <span className="text-primary/50">Required</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline text-sm">badge</span>
              </div>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base py-3 pl-10 pr-4 transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_1px_#2F80ED]"
                id="username" name="username"
                placeholder="Enter your username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between" htmlFor="password">
              <span>Access Key</span>
              <a className="text-primary hover:underline transition-all" href="#" tabIndex={-1}>Forgot Key?</a>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline text-sm">lock</span>
              </div>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base py-3 pl-10 pr-4 transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_1px_#2F80ED]"
                id="password" name="password"
                placeholder="••••••••••••"
                required type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error */}
          {(localError || error) && (
            <div className="bg-error-container/20 border border-error p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
              <p className="text-body-sm text-on-error-container">{localError || error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            className="w-full bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-headline-md py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={submitting || loading}
          >
            {submitting || loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span className="font-label-caps text-label-caps">Authenticating...</span>
              </>
            ) : (
              <>
                <span className="font-label-caps text-label-caps">Secure Login</span>
                <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Premium Military Copyright Footer (fixed at bottom of page) ── */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none select-none">
        <div className="max-w-[400px] mx-auto px-container-padding pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <div className="border-t border-outline-variant/20 pt-4 space-y-1.5">
            <p className="font-data-mono text-[10px] text-outline/35 tracking-[0.12em] uppercase">
              SKYGUARD TACTICAL AIRSPACE MANAGEMENT SYSTEM
            </p>
            <p className="font-data-mono text-[9px] text-outline/30">
              © 2026 All Rights Reserved.
            </p>
            <p className="font-data-mono text-[9px] text-outline/30">
              Designed &amp; Engineered by
            </p>
            <p className="font-data-mono text-[11px] font-bold text-primary/70 tracking-wide">
              First Lieutenant Belal Essam
            </p>
            <p className="font-data-mono text-[9px] text-outline/30">
              Electronic Warfare &amp; Communications Engineer
            </p>
            <p className="font-data-mono text-[7px] text-outline/20 leading-tight max-w-[340px] mx-auto">
              Unauthorized copying, redistribution, reverse engineering, modification, or commercial use of this software is strictly prohibited.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
