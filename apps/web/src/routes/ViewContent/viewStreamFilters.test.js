import { shouldInheritUserStreamFilters } from './viewStreamFilters'

describe('shouldInheritUserStreamFilters', () => {
  it('does not inherit leftover filters on All Activity', () => {
    expect(shouldInheritUserStreamFilters({ view: 'all' })).toBe(false)
  })

  it('does not inherit leftover filters on collection or custom views', () => {
    expect(shouldInheritUserStreamFilters({ view: 'collection' })).toBe(false)
    expect(shouldInheritUserStreamFilters({ view: 'custom' })).toBe(false)
    expect(shouldInheritUserStreamFilters({ view: 'discussions', customViewId: '12' })).toBe(false)
    expect(shouldInheritUserStreamFilters({ view: 'discussions', streamViewConfig: { type: 'collection' } })).toBe(false)
  })

  it('inherits user stream filters on typed system views', () => {
    expect(shouldInheritUserStreamFilters({ view: 'discussions' })).toBe(true)
    expect(shouldInheritUserStreamFilters({ view: 'events' })).toBe(true)
    expect(shouldInheritUserStreamFilters({ view: 'projects' })).toBe(true)
  })
})
