// My Home menu items that open a page which may be empty, and the Me field
// (see MeQuery) saying whether there is anything in it
const EMPTY_FLAG_BY_VIEW_TYPE = {
  tracks: 'hasTracks',
  'funding-rounds': 'hasFundingRounds',
  transactions: 'hasTransactions',
  'saved-searches': 'hasSavedSearches'
}

/**
 * Marks My Home menu views with nothing behind them as `isEmpty`, so the menu
 * can show them greyed out (not hidden). Only an explicit `false` counts: while
 * the fields are loading, or from an older payload, items look as usual.
 */
export function markEmptyMyHomeViews (views, currentUser) {
  if (!views) return views
  return views.map(view => {
    const flag = EMPTY_FLAG_BY_VIEW_TYPE[view.type]
    if (!flag || currentUser?.[flag] !== false) return view
    return { ...view, isEmpty: true }
  })
}

/** Classes for a greyed-out (empty) menu item; it stays clickable. */
export const EMPTY_MENU_ITEM_CLASS = 'opacity-50 hover:opacity-70'
