/**
 * User stream type / "active only" settings are shared across views.
 * Collections and custom views must not inherit them — that leftover filter
 * hides curated posts and shows "Nothing here yet".
 */
export function shouldInheritUserStreamFilters ({ view, customViewId, streamViewConfig }) {
  if (view === 'all' || view === 'custom' || view === 'collection') return false
  if (customViewId || streamViewConfig) return false
  return true
}
