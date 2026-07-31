import { useEffect, useState } from 'react'

export function BottomBar({ activeDrones = 0 }: { activeDrones?: number }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (tz: string) => {
    return now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <footer className="w-full z-50 flex justify-between items-center px-2 sm:px-5 py-1.5 sm:py-2 bg-surface-dim border-t border-outline-variant h-11 sm:h-12 shrink-0 gap-2 sm:gap-8 overflow-x-hidden">
      {/* Left section */}
      <div className="flex gap-2 sm:gap-8 items-center min-w-0">
        <div className="text-on-surface-variant flex items-center gap-1.5 sm:gap-3 text-label-caps text-[10px] sm:text-[11px] shrink-0">
          <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary">monitor_heart</span>
          <span className="text-on-surface-variant tracking-wide hidden sm:inline">System Health</span>
        </div>
        <div className="w-px h-5 sm:h-6 bg-outline-variant/50 shrink-0" />
        <div className="text-on-surface-variant flex items-center gap-1.5 sm:gap-3 text-label-caps text-[10px] sm:text-[11px] shrink-0">
          <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-[#2F80ED]">airplanemode_active</span>
          <span className="tracking-wide hidden sm:inline">Active Drones:</span>
          <span className="text-data-mono text-[#56CCF2] font-bold text-xs sm:text-sm">{String(activeDrones).padStart(2, '0')}</span>
        </div>
        <div className="w-px h-5 sm:h-6 bg-outline-variant/50 shrink-0" />
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-label-caps text-[10px] sm:text-[11px] text-[#2F80ED] font-bold tracking-wider shrink-0">EGYPT</span>
            <span className="text-data-mono text-on-surface text-[10px] sm:text-xs tracking-wider whitespace-nowrap">{formatTime('Africa/Cairo')}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-label-caps text-[10px] sm:text-[11px] text-[#27AE60] font-bold tracking-wider shrink-0">KSA</span>
            <span className="text-data-mono text-on-surface text-[10px] sm:text-xs tracking-wider whitespace-nowrap">{formatTime('Asia/Riyadh')}</span>
          </div>
        </div>
      </div>

      {/* Right section — secondary info hidden on small screens to prevent overflow */}
      <div className="hidden lg:flex gap-8 items-center shrink-0">
        <div className="flex items-center gap-3 text-label-caps text-[11px]">
          <span className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-[#27AE60]">wifi</span>
            <span className="tracking-wide">Connectivity</span>
          </span>
          <span className="text-data-mono text-[#34D399] font-bold text-xs">100%</span>
        </div>
        <div className="w-px h-6 bg-outline-variant/50" />
        <div className="flex items-center gap-2 text-label-caps text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-[#F2994A]">sync</span>
          <span className="tracking-wide">Sync Active</span>
        </div>
        <div className="w-px h-6 bg-outline-variant/50" />
        <div className="text-[10px] font-data-mono text-outline/60 tracking-wider select-none whitespace-nowrap">
          © First Lieutenant / Belal Essam
        </div>
      </div>
    </footer>
  )
}
