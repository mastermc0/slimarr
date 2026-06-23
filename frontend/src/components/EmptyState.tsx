import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
    >
      <div className={`mb-4 flex items-center justify-center rounded-full bg-white/5 ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
        <Icon
          size={compact ? 22 : 28}
          className="text-gray-500"
          strokeWidth={1.5}
        />
      </div>
      <p className={`font-medium text-gray-300 ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {description && (
        <p className={`mt-1 text-gray-500 ${compact ? 'text-xs' : 'text-sm'} max-w-xs`}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
