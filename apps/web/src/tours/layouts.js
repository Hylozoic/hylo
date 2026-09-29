/**
 * Layouts a tour step can adapt to. The sidebar needs no marker; the top-bar
 * global nav (TopNav) and the full-screen card menu (ContextMenuGrid) mark
 * their root with data-tour-layout, and a step's `variants` entry for that
 * layout is merged over the step (usually a different popover side or wording).
 * Anchors keep the same data-tour names in every layout.
 */
export const TOUR_LAYOUT_TABS = 'tabs'
export const TOUR_LAYOUT_GRID = 'grid'

/** The layouts currently on screen, read from data-tour-layout markers. */
export function activeTourLayouts (root = typeof document !== 'undefined' ? document : null) {
  const layouts = new Set()
  if (!root) return layouts
  root.querySelectorAll('[data-tour-layout]').forEach(el => layouts.add(el.getAttribute('data-tour-layout')))
  return layouts
}

/** Applies each step's variants for the given layouts and drops the `variants` key. */
export function resolveTourSteps (steps, layouts = activeTourLayouts()) {
  return steps.map(step => {
    if (!step.variants) return step
    const { variants, ...base } = step
    return Object.entries(variants).reduce((resolved, [layout, override]) => {
      if (!layouts.has(layout)) return resolved
      return {
        ...resolved,
        ...override,
        popover: { ...resolved.popover, ...override.popover }
      }
    }, base)
  })
}
