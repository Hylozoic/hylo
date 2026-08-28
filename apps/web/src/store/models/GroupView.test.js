import { isMenuViewVisible, viewAcceptedByPostTypes } from './GroupView'

describe('viewAcceptedByPostTypes', () => {
  it('allows every view type when acceptedPostTypes is null', () => {
    expect(viewAcceptedByPostTypes('discussions', null)).toBe(true)
    expect(viewAcceptedByPostTypes('events', undefined)).toBe(true)
  })

  it('always allows views that are not tied to a post type', () => {
    expect(viewAcceptedByPostTypes('all', [])).toBe(true)
    expect(viewAcceptedByPostTypes('chat', ['discussion'])).toBe(true)
    expect(viewAcceptedByPostTypes('members', [])).toBe(true)
    expect(viewAcceptedByPostTypes('custom', ['event'])).toBe(true)
  })

  it('hides typed views whose post types are not accepted', () => {
    expect(viewAcceptedByPostTypes('discussions', ['event'])).toBe(false)
    expect(viewAcceptedByPostTypes('events', ['discussion'])).toBe(false)
    expect(viewAcceptedByPostTypes('projects', [])).toBe(false)
  })

  it('keeps typed views when any of their post types are accepted', () => {
    expect(viewAcceptedByPostTypes('discussions', ['discussion', 'event'])).toBe(true)
    expect(viewAcceptedByPostTypes('requests-and-offers', ['offer'])).toBe(true)
    expect(viewAcceptedByPostTypes('requests-and-offers', ['request'])).toBe(true)
  })
})

describe('isMenuViewVisible', () => {
  it('hides off-menu views even when the post type is accepted', () => {
    expect(isMenuViewVisible({ type: 'discussions', order: null }, ['discussion'])).toBe(false)
  })

  it('hides on-menu typed views that are not accepted', () => {
    expect(isMenuViewVisible({ type: 'events', order: 2 }, ['discussion'])).toBe(false)
  })

  it('shows on-menu typed views that are still accepted', () => {
    expect(isMenuViewVisible({ type: 'events', order: 2 }, ['event'])).toBe(true)
    expect(isMenuViewVisible({ type: 'all', order: 0 }, [])).toBe(true)
  })
})
