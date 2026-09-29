import { formatParamPreview } from './savedSearch'

describe('formatParamPreview', () => {
  const search = { context: 'all', postTypes: ['discussion', 'event'] }

  it('names the cross-group feed All My Groups', () => {
    expect(formatParamPreview(search)).toBe('All My Groups • Post types: discussion, event')
  })

  it('translates the context name with the given t', () => {
    const t = key => ({ 'All My Groups': 'Todos mis grupos', 'Public Groups': 'Grupos Públicos' }[key] || key)
    expect(formatParamPreview(search, t)).toBe('Todos mis grupos • Post types: discussion, event')
    expect(formatParamPreview({ ...search, context: 'public' }, t)).toBe('Grupos Públicos • Post types: discussion, event')
  })
})
