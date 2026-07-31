interface DataRowProps {
  label: string
  value: string
  color?: string
  labelWidth?: string
}

export function DataRow({ label, value, color, labelWidth = 'w-24' }: DataRowProps) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-label-caps text-outline shrink-0 ${labelWidth}`}>{label}</span>
      <span
        className="text-data-mono truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export function DataGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>
}
