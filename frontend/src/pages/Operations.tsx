import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { useSocket } from '@/hooks/useSocket'
import type { PersistentJob, StorageOperationItem, StorageOperationsSnapshot } from '@/lib/types'
import EmptyState from '@/components/EmptyState'
import { SkeletonTable } from '@/components/Skeleton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatBytes as fmtBytes } from '@/lib/format'

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso + 'Z').getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso + 'Z').toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  cancelling: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  completed: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
  cancelled: 'bg-gray-500/15 text-gray-500 border-gray-600/20',
  recovery_required: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status === 'running' && <Loader2 size={10} className="animate-spin" />}
      {status}
    </span>
  )
}

function OpStatusDot({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle size={13} className="text-emerald-400 shrink-0" />
  if (status === 'failed') return <XCircle size={13} className="text-rose-400 shrink-0" />
  if (status === 'skipped') return <AlertCircle size={13} className="text-amber-400 shrink-0" />
  return <Clock size={13} className="text-gray-500 shrink-0" />
}

const KIND_LABELS: Record<string, string> = {
  manual_scan: 'Library Scan',
  full_cycle: 'Automation Cycle',
  duplicate_preview: 'Duplicate Preview',
  duplicate_cleanup: 'Duplicate Cleanup',
  scheduler_task: 'Scheduled Task',
}

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ')
}

interface JobRowProps {
  job: PersistentJob
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  actionInFlight: string | null
}

function JobRow({ job, onCancel, onRetry, actionInFlight }: JobRowProps) {
  const [expanded, setExpanded] = useState(false)
  const isActive = ['queued', 'running', 'cancelling'].includes(job.status)
  const isFailed = ['failed', 'recovery_required'].includes(job.status)
  const busy = actionInFlight === job.id

  const duration =
    job.started_at && job.completed_at
      ? Date.parse(job.completed_at + 'Z') - Date.parse(job.started_at + 'Z')
      : null

  return (
    <>
      <tr className="group border-b border-white/5 hover:bg-white/[0.02]">
        <td className="py-2.5 pl-3 pr-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-left text-gray-400 hover:text-gray-200"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse events' : 'Expand events'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="py-2.5 pr-3">
          <span className="text-sm font-medium text-gray-200">{kindLabel(job.kind)}</span>
        </td>
        <td className="py-2.5 pr-3">
          <StatusPill status={job.status} />
        </td>
        <td className="py-2.5 pr-3 text-xs text-gray-500 tabular-nums">
          {job.started_at ? fmtTimestamp(job.started_at) : fmtTimestamp(job.created_at)}
        </td>
        <td className="py-2.5 pr-3 text-xs text-gray-500 tabular-nums">
          {duration !== null ? fmtDuration(duration) : isActive ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : '-'}
        </td>
        <td className="py-2.5 pr-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {isActive && (
              <button
                onClick={() => onCancel(job.id)}
                disabled={busy || job.status === 'cancelling'}
                title="Cancel job"
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                Cancel
              </button>
            )}
            {isFailed && (
              <button
                onClick={() => onRetry(job.id)}
                disabled={busy}
                title="Retry job"
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Retry
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Event timeline */}
      {expanded && (
        <tr className="border-b border-white/5">
          <td colSpan={6} className="px-6 pb-3 pt-1">
            {job.error_message && (
              <div className="mb-2 rounded-md bg-rose-500/8 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
                {job.error_message}
              </div>
            )}
            {Array.isArray(job.events) && job.events.length > 0 ? (
              <ol className="relative ml-1 border-l border-white/10 space-y-2 text-xs pl-4">
                {(job.events as Array<{ event: string; message?: string; created_at?: string }>).map((ev, i) => (
                  <li key={i} className="text-gray-400">
                    <span className="mr-2 text-gray-600">{fmtTimestamp(ev.created_at)}</span>
                    <span className="font-medium text-gray-300">{ev.event}</span>
                    {ev.message && ev.message !== `${ev.event} ${job.kind}` && (
                      <span className="text-gray-500 ml-1">- {ev.message}</span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-600 italic">No event timeline available for this job.</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function StorageOpRow({ op }: { op: StorageOperationItem }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="py-2 pl-3 pr-3">
        <div className="flex items-center gap-2">
          <OpStatusDot status={op.status} />
          <span className="text-xs font-medium text-gray-300">
            {op.operation}
            {op.purpose ? ` / ${op.purpose.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      </td>
      <td className="py-2 pr-3 text-xs text-gray-500 max-w-[220px] truncate" title={op.source_path ?? undefined}>
        {op.source_path ? op.source_path.split('/').pop() ?? op.source_path : '-'}
      </td>
      <td className="py-2 pr-3 text-xs tabular-nums text-gray-500">
        {op.bytes_estimated ? fmtBytes(op.bytes_estimated) : '-'}
      </td>
      <td className="py-2 pr-3 text-xs tabular-nums text-gray-500">
        {fmtDuration(op.duration_ms)}
      </td>
      <td className="py-2 pr-2 text-right text-xs tabular-nums text-gray-600">
        {fmtRelative(op.completed_at ?? op.started_at)}
      </td>
    </tr>
  )
}

type JobFilter = 'active' | 'all' | 'failed' | 'completed' | 'cancelled'
type OpsSource = 'memory' | 'persisted'

export default function Operations() {
  const [jobs, setJobs] = useState<PersistentJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobFilter, setJobFilter] = useState<JobFilter>('active')
  const [opsSnapshot, setOpsSnapshot] = useState<StorageOperationsSnapshot | null>(null)
  const [opsLoading, setOpsLoading] = useState(true)
  const [opsSource, setOpsSource] = useState<OpsSource>('memory')
  const [actionInFlight, setActionInFlight] = useState<string | null>(null)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const [purging, setPurging] = useState(false)

  const { toast } = useToast()

  const loadJobs = useCallback(
    async (showLoading = false) => {
      if (showLoading) setJobsLoading(true)
      try {
        const status = jobFilter === 'active' ? 'active' : jobFilter === 'all' ? 'all' : jobFilter
        const data = await api.jobs({ status, limit: 100 })
        setJobs((data as { jobs: PersistentJob[] }).jobs ?? [])
      } catch {
        // silently keep stale state
      } finally {
        if (showLoading) setJobsLoading(false)
      }
    },
    [jobFilter],
  )

  const loadOps = useCallback(async (showLoading = false) => {
    if (showLoading) setOpsLoading(true)
    try {
      const data = await api.storageOperations({ limit: 50 })
      setOpsSnapshot(data as StorageOperationsSnapshot)
    } catch {
      // silently keep stale state
    } finally {
      if (showLoading) setOpsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs(true)
  }, [loadJobs])

  useEffect(() => {
    loadOps(true)
  }, [loadOps])

  // Auto-refresh active jobs every 10 s
  useEffect(() => {
    const iv = setInterval(() => {
      if (!document.hidden) loadJobs()
    }, 10_000)
    return () => clearInterval(iv)
  }, [loadJobs])

  useSocket('scan:completed', () => loadJobs())
  useSocket('orchestrator:status', () => loadJobs())

  const handleCancel = async (jobId: string) => {
    setActionInFlight(jobId)
    try {
      await api.cancelJob(jobId)
      toast('Cancellation requested', 'info')
      await loadJobs()
    } catch {
      toast('Failed to cancel job', 'error')
    } finally {
      setActionInFlight(null)
    }
  }

  const handleRetry = async (jobId: string) => {
    setActionInFlight(jobId)
    try {
      await api.retryJob(jobId)
      toast('Job retry started', 'success')
      await loadJobs()
    } catch {
      toast('Failed to retry job', 'error')
    } finally {
      setActionInFlight(null)
    }
  }

  const handlePurge = async () => {
    setPurging(true)
    try {
      const result = await api.purgeOldTelemetry({ keep_days: 30 }) as {
        jobs_removed: number
        storage_operations_removed: number
      }
      toast(
        `Purged ${result.jobs_removed} job(s) and ${result.storage_operations_removed} storage record(s)`,
        'success',
      )
      await Promise.all([loadJobs(true), loadOps(true)])
    } catch {
      toast('Purge failed', 'error')
    } finally {
      setPurging(false)
      setPurgeDialogOpen(false)
    }
  }

  // Derive displayed ops
  const opsDisplayed: StorageOperationItem[] =
    opsSource === 'memory'
      ? opsSnapshot?.recent ?? []
      : opsSnapshot?.persisted?.recent ?? []

  const nasPolicyData = opsSnapshot?.nas_policy
  const cooldownActive = nasPolicyData?.cooldown_active ?? false

  const activeJobs = jobs.filter((j) => ['queued', 'running', 'cancelling'].includes(j.status))
  const failedJobs = jobs.filter((j) => ['failed', 'recovery_required'].includes(j.status))

  const JOB_FILTERS: { label: string; value: JobFilter }[] = [
    { label: 'Active', value: 'active' },
    { label: 'All', value: 'all' },
    { label: 'Failed', value: 'failed' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-brand-green" />
            Operations
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Persistent jobs, storage operations, and NAS budget state
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPurgeDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-rose-500/30 hover:text-rose-300 transition-colors"
            title="Purge records older than 30 days"
          >
            <Trash2 size={13} />
            Purge old records
          </button>
          <button
            onClick={() => { void loadJobs(); void loadOps() }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-white/20 hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Active job + NAS summary strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-gray-900/60 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Active jobs</div>
          <div className="text-2xl font-bold text-white">{activeJobs.length}</div>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${failedJobs.length > 0 ? 'border-rose-500/20 bg-rose-500/5' : 'border-white/5 bg-gray-900/60'}`}>
          <div className="text-xs text-gray-500 mb-1">Failed / recovery needed</div>
          <div className={`text-2xl font-bold ${failedJobs.length > 0 ? 'text-rose-300' : 'text-white'}`}>{failedJobs.length}</div>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${cooldownActive ? 'border-orange-500/20 bg-orange-500/5' : 'border-white/5 bg-gray-900/60'}`}>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            {cooldownActive ? (
              <><ShieldAlert size={12} className="text-orange-400" /> NAS cooldown</>
            ) : (
              <><ShieldCheck size={12} className="text-emerald-400" /> NAS storage</>
            )}
          </div>
          <div className={`text-sm font-medium ${cooldownActive ? 'text-orange-300' : 'text-emerald-400'}`}>
            {cooldownActive
              ? `Cooling down (${nasPolicyData?.cooldown_remaining_seconds ?? 0}s)`
              : nasPolicyData
              ? `${nasPolicyData.active_operations} active op${nasPolicyData.active_operations !== 1 ? 's' : ''}`
              : '-'}
          </div>
          {nasPolicyData && (
            <div className="text-[11px] text-gray-600 mt-0.5">
              24h: {fmtBytes(nasPolicyData.write_bytes_used_24h ?? 0)} written / {nasPolicyData.replacements_24h ?? 0} replacements
            </div>
          )}
        </div>
      </div>

      {/* Jobs panel */}
      <section className="rounded-xl border border-white/5 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            Jobs
          </h2>
          <div className="flex items-center gap-1">
            {JOB_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setJobFilter(f.value)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  jobFilter === f.value
                    ? 'bg-brand-green/20 text-brand-green font-medium'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button onClick={() => loadJobs(true)} className="ml-1 rounded p-1 text-gray-600 hover:text-gray-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {jobsLoading ? (
          <div className="p-4">
            <SkeletonTable rows={4} />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No jobs"
            description={
              jobFilter === 'active'
                ? 'No active jobs right now.'
                : `No ${jobFilter} jobs found.`
            }
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-gray-600">
                  <th className="py-2 pl-3 pr-2 w-8" />
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onCancel={handleCancel}
                    onRetry={handleRetry}
                    actionInFlight={actionInFlight}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Storage operations panel */}
      <section className="rounded-xl border border-white/5 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <HardDrive size={14} className="text-gray-400" />
            Storage Operations
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpsSource('memory')}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                opsSource === 'memory'
                  ? 'bg-brand-green/20 text-brand-green font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setOpsSource('persisted')}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                opsSource === 'persisted'
                  ? 'bg-brand-green/20 text-brand-green font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              History
            </button>
            <button onClick={() => loadOps(true)} className="ml-1 rounded p-1 text-gray-600 hover:text-gray-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {opsLoading ? (
          <div className="p-4">
            <SkeletonTable rows={4} />
          </div>
        ) : opsDisplayed.length === 0 ? (
          <EmptyState
            icon={HardDrive}
            title="No storage operations"
            description="Storage moves and deletes will appear here."
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-gray-600">
                  <th className="py-2 pl-3 pr-3">Operation</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2 pr-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {opsDisplayed.map((op, i) => (
                  <StorageOpRow key={i} op={op} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* NAS budget footer */}
        {nasPolicyData && (
          <div className="border-t border-white/5 px-4 py-2.5 flex flex-wrap gap-4 text-[11px] text-gray-600">
            <span>Active ops: <span className="text-gray-400">{nasPolicyData.active_operations}</span></span>
            <span>24h writes: <span className="text-gray-400">{fmtBytes(nasPolicyData.write_bytes_used_24h ?? 0)}</span></span>
            <span>24h replacements: <span className="text-gray-400">{nasPolicyData.replacements_24h ?? 0}</span></span>
            {cooldownActive && (
              <span className="text-orange-400">NAS cooldown active - {nasPolicyData.cooldown_remaining_seconds ?? 0}s remaining</span>
            )}
          </div>
        )}
      </section>

      {/* Purge confirm dialog */}
      <ConfirmDialog
        open={purgeDialogOpen}
        title="Purge old telemetry"
        message="Remove all terminal job records and storage operation logs older than 30 days. Active or queued jobs will not be affected."
        confirmLabel="Purge"
        destructive
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeDialogOpen(false)}
      />
    </div>
  )
}
