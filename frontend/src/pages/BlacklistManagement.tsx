import { useEffect, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import { SkeletonTable } from '@/components/Skeleton'
import type { BlacklistEntry } from '@/lib/types'

export default function BlacklistManagement() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([])
  const [releaseTitle, setReleaseTitle] = useState('')
  const [reason, setReason] = useState('manual')
  const [loading, setLoading] = useState(true)
  const [pendingRemove, setPendingRemove] = useState<BlacklistEntry | null>(null)
  const [removing, setRemoving] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    try {
      const data = await api.getBlacklist()
      setEntries(data as BlacklistEntry[])
    } catch {
      toast('Failed to load blacklist', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const addEntry = async () => {
    if (!releaseTitle.trim()) {
      toast('Enter a release title', 'error')
      return
    }
    try {
      await api.addBlacklistEntry({
        release_title: releaseTitle.trim(),
        reason,
        expires_in_days: 30,
      })
      setReleaseTitle('')
      toast('Blacklist entry added', 'success')
      await load()
    } catch {
      toast('Failed to add blacklist entry', 'error')
    }
  }

  const removeEntry = async () => {
    if (!pendingRemove) return
    setRemoving(true)
    try {
      await api.removeBlacklistEntry(pendingRemove.release_hash)
      toast('Blacklist entry removed', 'success')
      setPendingRemove(null)
      await load()
    } catch {
      toast('Failed to remove blacklist entry', 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Blacklist</h1>

      <div className="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add Entry</h2>
        <input
          value={releaseTitle}
          onChange={(e) => setReleaseTitle(e.target.value)}
          placeholder="Release title"
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm"
        />
        <button
          onClick={addEntry}
          className="px-3 py-1.5 rounded bg-brand-green hover:bg-green-600 text-sm text-white"
        >
          Add to Blacklist
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold">
          Entries ({entries.length})
        </div>
        {loading ? (
          <div className="px-4 py-3">
            <SkeletonTable rows={4} />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title="No blacklist entries"
            description="Releases you blacklist will appear here and be skipped by future searches."
            compact
          />
        ) : (
          <div className="divide-y divide-gray-800">
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{e.release_title}</p>
                  <p className="text-xs text-gray-400">{e.reason || 'n/a'}</p>
                </div>
                <button
                  onClick={() => setPendingRemove(e)}
                  className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove Blacklist Entry?"
        message={
          pendingRemove
            ? `"${pendingRemove.release_title}" will become eligible for search and download again.`
            : ''
        }
        confirmLabel={removing ? 'Removing…' : 'Remove'}
        destructive
        loading={removing}
        onConfirm={removeEntry}
        onCancel={() => !removing && setPendingRemove(null)}
      />
    </div>
  )
}
