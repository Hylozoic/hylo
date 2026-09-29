import { MY_CONTEXT_VIEWS } from '@hylo/presenters/GroupViewPresenter'
import { markEmptyMyHomeViews } from './myHomeMenu'

const emptyTypes = views => views.filter(view => view.isEmpty).map(view => view.type)

describe('markEmptyMyHomeViews', () => {
  const views = MY_CONTEXT_VIEWS('/members/1')

  it('marks the items with nothing in them as empty, for everyone', () => {
    const me = { hasTracks: false, hasFundingRounds: false, hasTransactions: false, hasSavedSearches: false }
    expect(emptyTypes(markEmptyMyHomeViews(views, me))).toEqual(['tracks', 'funding-rounds', 'transactions', 'saved-searches'])
  })

  it('leaves items with something in them as they are', () => {
    const me = { hasTracks: true, hasFundingRounds: false, hasTransactions: true, hasSavedSearches: true }
    expect(emptyTypes(markEmptyMyHomeViews(views, me))).toEqual(['funding-rounds'])
  })

  it('keeps every item (greyed, not hidden)', () => {
    const me = { hasTracks: false, hasFundingRounds: false, hasTransactions: false, hasSavedSearches: false }
    expect(markEmptyMyHomeViews(views, me)).toHaveLength(views.length)
  })

  it('does not grey anything out before the fields have loaded', () => {
    expect(emptyTypes(markEmptyMyHomeViews(views, {}))).toEqual([])
    expect(emptyTypes(markEmptyMyHomeViews(views, null))).toEqual([])
  })

  it('passes through a missing menu', () => {
    expect(markEmptyMyHomeViews(null, {})).toBeNull()
  })
})
