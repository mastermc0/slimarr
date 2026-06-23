export type NasPresetName = 'gentle' | 'balanced' | 'aggressive'

export interface NasPreset {
  min_cycle_interval_minutes: number
  max_downloads_per_night: number
  throttle_seconds: number
  min_savings_mb_for_nas: number
  enable_media_probe: boolean
  nas_max_write_gb_per_day: number
  nas_max_replacements_per_day: number
  nas_max_transfer_mbps: number
}

export const NAS_PRESETS: Record<NasPresetName, NasPreset> = {
  gentle: {
    min_cycle_interval_minutes: 240,
    max_downloads_per_night: 2,
    throttle_seconds: 90,
    min_savings_mb_for_nas: 700,
    enable_media_probe: false,
    nas_max_write_gb_per_day: 80,
    nas_max_replacements_per_day: 2,
    nas_max_transfer_mbps: 25,
  },
  balanced: {
    min_cycle_interval_minutes: 180,
    max_downloads_per_night: 3,
    throttle_seconds: 60,
    min_savings_mb_for_nas: 500,
    enable_media_probe: false,
    nas_max_write_gb_per_day: 150,
    nas_max_replacements_per_day: 3,
    nas_max_transfer_mbps: 50,
  },
  aggressive: {
    min_cycle_interval_minutes: 120,
    max_downloads_per_night: 5,
    throttle_seconds: 30,
    min_savings_mb_for_nas: 300,
    enable_media_probe: false,
    nas_max_write_gb_per_day: 300,
    nas_max_replacements_per_day: 5,
    nas_max_transfer_mbps: 100,
  },
}
