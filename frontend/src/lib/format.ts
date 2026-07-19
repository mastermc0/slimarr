const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/**
 * Adaptive byte formatter — picks the largest unit where the value is >= 1,
 * using binary (1024) steps (matches Windows Explorer/Task Manager, which is
 * what most Slimarr users compare these numbers against).
 */
export function formatBytes(bytes?: number | null, decimals = 1): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** idx
  return `${idx === 0 ? value.toFixed(0) : value.toFixed(decimals)} ${UNITS[idx]}`
}

/**
 * Fixed-unit GB formatter for contexts that want a stable column/label
 * (stat cards, size bars) rather than adaptive scaling. Uses the same
 * 1024-based GB as formatBytes so the two never disagree on the same value —
 * previously some pages divided by 1e9 (decimal GB) and others by 2^30
 * (binary GB/"GiB"), so the same file showed two different sizes depending
 * on which page you were looking at.
 */
export function formatGB(bytes?: number | null, decimals = 1): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  return `${(bytes / 1024 ** 3).toFixed(decimals)} GB`
}
