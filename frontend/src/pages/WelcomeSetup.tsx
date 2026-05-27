import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { auth } from '@/lib/auth'
import { useToast } from '@/components/Toast'
import { CheckCircle2, Rocket, SlidersHorizontal } from 'lucide-react'

type Preset = 'gentle' | 'balanced' | 'aggressive'

export default function WelcomeSetup() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [nasPrefix, setNasPrefix] = useState('Z:/')
  const [preset, setPreset] = useState<Preset>('balanced')
  const [saving, setSaving] = useState(false)

  const presets: Record<Preset, { min_cycle_interval_minutes: number; max_downloads_per_night: number; throttle_seconds: number; min_savings_mb_for_nas: number; enable_media_probe: boolean }> = {
    gentle: {
      min_cycle_interval_minutes: 240,
      max_downloads_per_night: 2,
      throttle_seconds: 90,
      min_savings_mb_for_nas: 700,
      enable_media_probe: false,
    },
    balanced: {
      min_cycle_interval_minutes: 180,
      max_downloads_per_night: 3,
      throttle_seconds: 60,
      min_savings_mb_for_nas: 500,
      enable_media_probe: false,
    },
    aggressive: {
      min_cycle_interval_minutes: 120,
      max_downloads_per_night: 5,
      throttle_seconds: 30,
      min_savings_mb_for_nas: 250,
      enable_media_probe: true,
    },
  }

  const completeSetup = async () => {
    setSaving(true)
    try {
      const settings = await api.getSettings() as Record<string, unknown>
      const next = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>
      const schedule = (next.schedule as Record<string, unknown> | undefined) ?? {}
      const comparison = (next.comparison as Record<string, unknown> | undefined) ?? {}
      const files = (next.files as Record<string, unknown> | undefined) ?? {}
      const p = presets[preset]

      schedule.min_cycle_interval_minutes = p.min_cycle_interval_minutes
      schedule.max_downloads_per_night = p.max_downloads_per_night
      schedule.throttle_seconds = p.throttle_seconds
      comparison.min_savings_mb_for_nas = p.min_savings_mb_for_nas
      files.enable_media_probe = p.enable_media_probe

      const prefixes = String(nasPrefix || '').trim()
      files.nas_path_prefixes = prefixes ? [prefixes] : ['Z:/']

      next.schedule = schedule
      next.comparison = comparison
      next.files = files

      await api.updateSettings(next)
      auth.markSetupWizardDone()
      toast('Setup completed. Slimarr tuned for your environment.', 'success')
      navigate('/')
    } catch {
      toast('Failed to save setup preferences', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 md:py-14">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(16,185,129,0.08),rgba(17,24,39,0.96)_38%,rgba(8,47,73,0.3)_100%)] p-6 md:p-8 shadow-[0_26px_46px_-30px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-2 text-emerald-300">
          <Rocket size={16} />
          <p className="text-xs uppercase tracking-[0.2em]">Welcome Setup</p>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-white">Make Slimarr feel right from day one</h1>
        <p className="mt-2 text-sm text-gray-300">
          One quick step to tune safety and throughput. You can always change this later in Settings.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-1">NAS movie path prefix</label>
            <input
              value={nasPrefix}
              onChange={(e) => setNasPrefix(e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green"
              placeholder="Z:/Movies"
            />
            <p className="mt-1 text-xs text-gray-500">Example: Z:/Movies or /mnt/nas-media/movies</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Performance profile</p>
            <div className="grid gap-2 md:grid-cols-3">
              {(['gentle', 'balanced', 'aggressive'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setPreset(item)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize text-left transition-colors ${preset === item ? 'border-emerald-300/60 bg-emerald-400/10 text-emerald-100' : 'border-gray-700 text-gray-200 hover:bg-gray-800'}`}
                >
                  <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-400">
                    <SlidersHorizontal size={12} />
                    {item}
                  </div>
                  <p className="mt-1 text-xs text-gray-300">
                    {item === 'gentle' ? 'Maximum NAS stability, slower but safer.' : item === 'balanced' ? 'Recommended default for most users.' : 'Faster upgrades for robust environments.'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/65 p-3">
            <p className="text-xs text-gray-300 flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-300" /> This setup only updates schedule and NAS-safety settings.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { void completeSetup() }}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-green text-white text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Finish Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
