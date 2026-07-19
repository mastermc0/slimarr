import { memo } from 'react'
import type { ActivityEntry } from '@/lib/types'
import { formatBytes } from '@/lib/format'

interface Props {
  entry: ActivityEntry
}

const eventLabels: Record<string, string> = {
  'replace:completed': 'Replaced',
  'download:started': 'Download Started',
  'download:completed': 'Download Completed',
  'download:failed': 'Download Failed',
  'scan:completed': 'Scan Completed',
}

function ActivityItem({ entry }: Props) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-800">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{entry.movie_title ?? 'System'}</p>
        <p className="text-xs text-gray-400">{eventLabels[entry.event] ?? entry.event}</p>
      </div>
      {entry.savings_bytes != null && entry.savings_bytes > 0 && (
        <div className="text-right shrink-0">
          <p className="text-sm text-green-400">−{formatBytes(entry.savings_bytes, 2)}</p>
          <p className="text-xs text-gray-500">{entry.savings_pct?.toFixed(1)}%</p>
        </div>
      )}
      <div className="text-xs text-gray-600 shrink-0 mt-0.5">
        {new Date(entry.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

export default memo(ActivityItem)
