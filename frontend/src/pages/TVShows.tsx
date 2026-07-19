import { memo, useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { Tv2, Eye, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatBytes } from '@/lib/format'

interface TVShow {
  plex_rating_key: string
  title: string
  year: number | null
  total_size_bytes: number
  episode_count: number
  poster_path: string | null
  last_watched_at: string | null
  watched_by: string[]
  never_watched: boolean
}

interface ShowsResponse {
  total: number
  stale_days_filter: number
  shows: TVShow[]
}

function fmtSize(bytes: number): string {
  return formatBytes(bytes, bytes >= 1024 ** 4 ? 2 : 1)
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function staleness(show: TVShow, staleDays: number): 'never' | 'stale' | 'watched' {
  if (show.never_watched) return 'never'
  if (staleDays > 0 && show.last_watched_at) {
    const last = new Date(show.last_watched_at).getTime()
    const cutoff = Date.now() - staleDays * 86400_000
    if (last < cutoff) return 'stale'
  }
  return 'watched'
}

interface ShowRowProps {
  show: TVShow
  staleDays: number
  onDelete: (show: TVShow) => void
}

function ShowRow({ show, staleDays, onDelete }: ShowRowProps) {
  const [expanded, setExpanded] = useState(false)
  const s = staleness(show, staleDays)

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden transition-all ${s === 'never' ? 'ring-1 ring-rose-800/50' : s === 'stale' ? 'ring-1 ring-amber-800/40' : ''}`}>
      <div className="flex items-center gap-4 p-4">
        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${s === 'never' ? 'bg-rose-500' : s === 'stale' ? 'bg-amber-500' : 'bg-emerald-500'}`} title={s === 'never' ? 'Never watched' : s === 'stale' ? 'Not watched recently' : 'Watched'} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold truncate">{show.title}</span>
            {show.year && <span className="text-gray-500 text-xs shrink-0">{show.year}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400">{show.episode_count} eps</span>
            <span className="text-xs text-gray-400">·</span>
            <span className={`text-xs font-medium ${s === 'never' ? 'text-rose-400' : s === 'stale' ? 'text-amber-400' : 'text-gray-400'}`}>
              {s === 'never'
                ? 'Never watched'
                : `Last watched ${fmtDate(show.last_watched_at)}`}
            </span>
            {show.watched_by.length > 0 && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">by {show.watched_by.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        {/* Size badge */}
        <div className="text-right shrink-0">
          <span className={`text-sm font-bold ${s === 'never' ? 'text-rose-300' : 'text-gray-300'}`}>
            {fmtSize(show.total_size_bytes)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((x) => !x)}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400"
            title="Details"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(show)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-700 text-rose-300 hover:text-white text-xs transition-colors"
            title="Delete this show"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
          <div>
            <p className="text-gray-600 mb-0.5">Episodes</p>
            <p className="text-white">{show.episode_count}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-0.5">Total size</p>
            <p className="text-white">{fmtSize(show.total_size_bytes)}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-0.5">Avg per episode</p>
            <p className="text-white">{show.episode_count > 0 ? fmtSize(show.total_size_bytes / show.episode_count) : '—'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-0.5">Watched by</p>
            <p className="text-white">{show.watched_by.length > 0 ? show.watched_by.join(', ') : 'Nobody'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const MemoizedShowRow = memo(ShowRow)

export default function TVShows() {
  const { toast } = useToast()
  const [data, setData] = useState<ShowsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [staleDays, setStaleDays] = useState(365)
  const [sort, setSort] = useState('size')
  const [pendingDelete, setPendingDelete] = useState<TVShow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sonarrEnabled, setSonarrEnabled] = useState(false)
  const [unmonitorSonarr, setUnmonitorSonarr] = useState(true)

  const requestDelete = useCallback((s: TVShow) => {
    setUnmonitorSonarr(true)
    setPendingDelete(s)
  }, [])

  useEffect(() => {
    api.getSettings().then((s: Record<string, unknown>) => {
      const sonarr = s?.sonarr as Record<string, unknown> | undefined
      setSonarrEnabled(!!(sonarr?.enabled && sonarr?.url && sonarr?.api_key))
    }).catch(() => {
      toast('Failed to load Sonarr settings', 'error')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.tvShows({ stale_days: staleDays, sort }).then((d: ShowsResponse) => {
      setData(d)
    }).catch(() => {
      toast('Failed to load TV shows from Plex', 'error')
    }).finally(() => setLoading(false))
  }, [staleDays, sort, toast])

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.deleteShow(pendingDelete.plex_rating_key, {
        plex_rating_key: pendingDelete.plex_rating_key,
        title: pendingDelete.title,
        unmonitor_sonarr: sonarrEnabled && unmonitorSonarr,
      })
      toast(`Deleted "${pendingDelete.title}"`, 'success')
      setPendingDelete(null)
      // Remove from local list immediately without a full reload
      setData((prev) =>
        prev
          ? { ...prev, shows: prev.shows.filter((s) => s.plex_rating_key !== pendingDelete.plex_rating_key), total: prev.total - 1 }
          : prev
      )
    } catch {
      toast(`Failed to delete "${pendingDelete.title}"`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const totalStaleSize = data?.shows.reduce((acc, s) => acc + s.total_size_bytes, 0) ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tv2 size={22} className="text-brand-green" />
        <h1 className="text-2xl font-bold flex-1">TV Show Cleanup</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : data ? 'Refresh' : 'Scan Now'}
        </button>
      </div>

      {/* Explanation banner */}
      <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-200">Slimarr recommendations — nothing happens automatically</p>
        <p>This page shows TV shows that haven't been watched recently. Slimarr surfaces them as candidates for deletion, but <strong className="text-white">you decide what to delete</strong>. Each deletion requires your explicit confirmation. Movies are handled automatically; TV shows are not.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Show shows unwatched for at least</label>
          <select
            value={staleDays}
            onChange={(e) => setStaleDays(Number(e.target.value))}
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value={0}>All shows (no filter)</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
            <option value={9999}>Never watched only</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value="size">Largest first</option>
            <option value="title">Title A–Z</option>
            <option value="last_watched">Oldest watched first</option>
          </select>
        </div>
        <button
          onClick={load}
          className="mt-4 px-4 py-1.5 rounded-lg bg-brand-green text-white text-sm hover:bg-green-600"
        >
          Apply
        </button>
      </div>

      {/* Stats summary */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{data.total}</p>
            <p className="text-xs text-gray-400 mt-1">Shows shown</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-rose-400">{data.shows.filter((s) => s.never_watched).length}</p>
            <p className="text-xs text-gray-400 mt-1">Never watched</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-300">{fmtSize(totalStaleSize)}</p>
            <p className="text-xs text-gray-400 mt-1">Reclaimable</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {data && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Never watched</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Not watched within filter period</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Watched recently</span>
        </div>
      )}

      {/* Show list */}
      {!data && !loading && (
        <div className="text-center py-16 text-gray-500">
          <Tv2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Click <strong className="text-gray-400">Scan Now</strong> to load your TV show library from Plex.</p>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-50" />
          <p>Scanning Plex library…</p>
        </div>
      )}

      {data && data.shows.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Eye size={40} className="mx-auto mb-3 opacity-30" />
          <p>No shows match the current filter.</p>
          <p className="text-xs mt-1">Try increasing the time window or removing the filter.</p>
        </div>
      )}

      {data && data.shows.length > 0 && (
        <div className="space-y-3">
          {data.shows.map((show) => (
            <MemoizedShowRow
              key={show.plex_rating_key}
              show={show}
              staleDays={staleDays === 9999 ? 0 : staleDays}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete TV Show?"
        message={
          pendingDelete
            ? `This will permanently delete "${pendingDelete.title}" (${fmtSize(pendingDelete.total_size_bytes)}) from your disk and remove it from Plex. This cannot be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Yes, Delete'}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      >
        {pendingDelete && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Episodes</span>
                <span>{pendingDelete.episode_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Disk usage</span>
                <span className="text-rose-300 font-medium">{fmtSize(pendingDelete.total_size_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last watched</span>
                <span>{fmtDate(pendingDelete.last_watched_at)}</span>
              </div>
            </div>
            {sonarrEnabled && (
              <label className="flex items-center gap-3 cursor-pointer select-none pt-2 border-t border-gray-700/50">
                <input
                  type="checkbox"
                  checked={unmonitorSonarr}
                  onChange={(e) => setUnmonitorSonarr(e.target.checked)}
                  className="w-4 h-4 accent-brand-green"
                />
                <span className="text-sm">Also unmonitor in Sonarr (prevents automatic re-download)</span>
              </label>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
