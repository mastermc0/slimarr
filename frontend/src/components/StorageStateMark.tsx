import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

interface PhaseDescriptor {
  label: string
  Icon: LucideIcon
  colorClass: string
  spin?: boolean
}

function humanize(phase: string): string {
  return phase.replace(/_/g, ' ')
}

/**
 * Maps a replacement-recovery `phase` string (e.g. "recycle_original_started",
 * "place_replacement_failed") to a consistent icon + label + color so the
 * Replacement Recovery and Operations panels show a quick visual read of
 * preflight/moving/verifying/recovery-required state instead of raw phase
 * text. Order matters: more specific checks (failed, missing) run first.
 */
export function describeReplacementPhase(phase: string | null | undefined): PhaseDescriptor {
  if (!phase) {
    return { label: 'No active phase', Icon: Clock, colorClass: 'text-gray-400' }
  }
  if (phase.includes('failed') || phase.includes('missing')) {
    return { label: humanize(phase), Icon: XCircle, colorClass: 'text-red-400' }
  }
  if (phase.startsWith('preflight')) {
    return { label: humanize(phase), Icon: ShieldCheck, colorClass: 'text-sky-300' }
  }
  if (phase.includes('recycle')) {
    const done = phase.includes('completed')
    return {
      label: humanize(phase),
      Icon: done ? CheckCircle : RotateCcw,
      colorClass: 'text-amber-300',
      spin: !done && phase.includes('started'),
    }
  }
  if (phase.includes('backup')) {
    const done = phase.includes('completed')
    return {
      label: humanize(phase),
      Icon: done ? CheckCircle : HardDrive,
      colorClass: 'text-amber-300',
    }
  }
  if (phase.includes('restore')) {
    return { label: humanize(phase), Icon: RotateCcw, colorClass: 'text-orange-300' }
  }
  if (phase.includes('place_replacement')) {
    const done = phase.includes('completed')
    return {
      label: humanize(phase),
      Icon: done ? CheckCircle : Loader2,
      colorClass: 'text-emerald-300',
      spin: !done,
    }
  }
  if (phase === 'db_committed') {
    return { label: 'Verified & committed', Icon: CheckCircle, colorClass: 'text-emerald-400' }
  }
  if (phase.includes('alert') || phase.includes('warn')) {
    return { label: humanize(phase), Icon: AlertTriangle, colorClass: 'text-orange-300' }
  }
  return { label: humanize(phase), Icon: Clock, colorClass: 'text-gray-400' }
}

export default function StorageStateMark({ phase }: { phase: string | null | undefined }) {
  const { label, Icon, colorClass, spin } = describeReplacementPhase(phase)
  return (
    <span className={`inline-flex items-center gap-1.5 ${colorClass}`}>
      <Icon size={13} className={spin ? 'animate-spin' : ''} />
      <span className="capitalize">{label}</span>
    </span>
  )
}
