import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  sub?: string
  color?: string
}

export default function StatCard({ label, value, icon: Icon, sub, color = 'text-brand-green' }: Props) {
  return (
    <div className="group relative overflow-hidden flex items-center gap-4 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(8,14,24,0.92))] p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur transition-all duration-200 hover:border-emerald-300/20 hover:shadow-[0_18px_44px_-24px_rgba(31,191,143,0.28)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className={`rounded-lg border border-white/10 bg-gray-800/80 p-3 shadow-inner ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}
