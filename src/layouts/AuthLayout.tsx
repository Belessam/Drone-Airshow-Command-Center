import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Grid overlay */}
      <div className="fixed inset-0 grid-overlay pointer-events-none" />
      {/* Map texture background */}
      <div
        className="fixed inset-0 map-texture pointer-events-none opacity-15"
        style={{
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        }}
      />
      {/* Scanline */}
      <div className="scanline" />

      <div className="relative z-10 w-full max-w-[400px] mx-container-padding pb-28">
        <Outlet />
      </div>

      {/* Telemetry corners */}
      <div className="fixed top-6 left-6 font-data-mono text-[10px] text-outline/40 space-y-1 pointer-events-none hidden lg:block">
        <div>LAT: 34.0522° N</div>
        <div>LNG: 118.2437° W</div>
        <div>ALT: 120M</div>
        <div>SPD: 0.0 KTS</div>
      </div>
      <div className="fixed bottom-6 right-6 font-data-mono text-[10px] text-outline/40 text-right space-y-1 pointer-events-none hidden lg:block">
        <div>CORE_TEMP: 34°C</div>
        <div>CPU_LOAD: 12%</div>
        <div>LINK_QUAL: 100%</div>
        <div>TOKEN: 0x92AF3...</div>
      </div>
    </div>
  )
}
