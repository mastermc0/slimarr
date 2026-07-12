import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { NAS_PRESETS, type NasPresetName } from '@/lib/nasPresets'

const NAS_PROFILE_SNAPSHOT_KEY = 'slimarr_nas_profile_snapshot'

export function hasNasProfileSnapshot(): boolean {
  return localStorage.getItem(NAS_PROFILE_SNAPSHOT_KEY) !== null
}

/**
 * Shared "apply a NAS preset" / "restore previous profile" flow used by both
 * the Dashboard's NAS-pressure banner and the System page's NAS policy
 * panel. Both pages read/write the same localStorage snapshot, so this used
 * to be ~100 lines duplicated in each file — kept here once so the two
 * surfaces can't drift out of sync with each other.
 */
export function useNasPresetManager(onApplied?: () => void) {
  const { toast } = useToast()
  const [applying, setApplying] = useState<string | null>(null)
  const [hasSnapshot, setHasSnapshot] = useState(hasNasProfileSnapshot)

  const applyNasPreset = useCallback(async (preset: NasPresetName) => {
    setApplying(preset)
    try {
      const settings = await api.getSettings() as Record<string, unknown>
      const currentSchedule = (settings.schedule as Record<string, unknown> | undefined) ?? {}
      const currentComparison = (settings.comparison as Record<string, unknown> | undefined) ?? {}
      const currentFiles = (settings.files as Record<string, unknown> | undefined) ?? {}
      localStorage.setItem(
        NAS_PROFILE_SNAPSHOT_KEY,
        JSON.stringify({
          schedule: {
            min_cycle_interval_minutes: currentSchedule.min_cycle_interval_minutes,
            max_downloads_per_night: currentSchedule.max_downloads_per_night,
            throttle_seconds: currentSchedule.throttle_seconds,
          },
          comparison: {
            min_savings_mb_for_nas: currentComparison.min_savings_mb_for_nas,
          },
          files: {
            enable_media_probe: currentFiles.enable_media_probe,
            nas_path_prefixes: currentFiles.nas_path_prefixes,
            nas_max_write_gb_per_day: currentFiles.nas_max_write_gb_per_day,
            nas_max_replacements_per_day: currentFiles.nas_max_replacements_per_day,
            nas_max_transfer_mbps: currentFiles.nas_max_transfer_mbps,
          },
        })
      )

      const next = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>
      const schedule = (next.schedule as Record<string, unknown> | undefined) ?? {}
      const comparison = (next.comparison as Record<string, unknown> | undefined) ?? {}
      const files = (next.files as Record<string, unknown> | undefined) ?? {}
      const cfg = NAS_PRESETS[preset]
      const hasNasPrefixes = ((files.nas_path_prefixes as string[] | undefined) ?? []).length > 0

      schedule.min_cycle_interval_minutes = cfg.min_cycle_interval_minutes
      schedule.max_downloads_per_night = cfg.max_downloads_per_night
      schedule.throttle_seconds = cfg.throttle_seconds
      comparison.min_savings_mb_for_nas = cfg.min_savings_mb_for_nas
      files.enable_media_probe = cfg.enable_media_probe
      files.nas_max_write_gb_per_day = cfg.nas_max_write_gb_per_day
      files.nas_max_replacements_per_day = cfg.nas_max_replacements_per_day
      files.nas_max_transfer_mbps = cfg.nas_max_transfer_mbps

      next.schedule = schedule
      next.comparison = comparison
      next.files = files

      await api.updateSettings(next)
      setHasSnapshot(true)
      toast(`Applied ${preset} NAS preset`, 'success')
      if (!hasNasPrefixes) {
        toast('Add your real NAS path in Settings to activate these limits', 'info')
      }
      onApplied?.()
    } catch {
      toast('Failed to apply NAS preset', 'error')
    } finally {
      setApplying(null)
    }
  }, [onApplied, toast])

  const restorePreviousNasProfile = useCallback(async () => {
    const raw = localStorage.getItem(NAS_PROFILE_SNAPSHOT_KEY)
    if (!raw) {
      toast('No previous NAS profile to restore', 'info')
      return
    }

    setApplying('restore')
    try {
      const snapshot = JSON.parse(raw) as {
        schedule?: Record<string, unknown>
        comparison?: Record<string, unknown>
        files?: Record<string, unknown>
      }
      const settings = await api.getSettings() as Record<string, unknown>
      const next = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>
      const schedule = (next.schedule as Record<string, unknown> | undefined) ?? {}
      const comparison = (next.comparison as Record<string, unknown> | undefined) ?? {}
      const files = (next.files as Record<string, unknown> | undefined) ?? {}

      Object.assign(schedule, snapshot.schedule ?? {})
      Object.assign(comparison, snapshot.comparison ?? {})
      Object.assign(files, snapshot.files ?? {})

      next.schedule = schedule
      next.comparison = comparison
      next.files = files

      await api.updateSettings(next)
      localStorage.removeItem(NAS_PROFILE_SNAPSHOT_KEY)
      setHasSnapshot(false)
      toast('Restored previous NAS profile', 'success')
      onApplied?.()
    } catch {
      toast('Failed to restore previous NAS profile', 'error')
    } finally {
      setApplying(null)
    }
  }, [onApplied, toast])

  return { applyNasPreset, restorePreviousNasProfile, applying, hasSnapshot }
}
