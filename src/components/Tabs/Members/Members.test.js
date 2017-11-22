import 'react-native'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import TestRenderer from 'react-test-renderer'
import Members, { Banner, Member } from './Members'

it('renders correctly with no community', () => {
  const members = [
    {id: '1', name: 'Foo Lane', location: 'here', bio: 'Hello!', avatarUrl: 'foo.gif'},
    {id: '2', name: 'Bar Jones', location: 'there', bio: 'Not a stork', avatarUrl: 'bar.png'},
    {id: '3', name: 'Baz Chu', bio: 'Could be', avatarUrl: 'baz.png'},
    {id: '4', name: 'Bonk Gundsdottir', avatarUrl: 'bonk.jpg'},
    {id: '5', avatarUrl: 'woof.png'}
  ]
  const renderer = TestRenderer.create(<Members members={members} />)
  expect(renderer).toMatchSnapshot()
})

it('matches the last header snapshot', () => {
  expect(Members.navigationOptions({ navigation: { state: {} }, screenProps: { currentTabName: 'Members' } })).toMatchSnapshot()
})

describe('Member', () => {
  it('matches the last snapshot', () => {
    const renderer = new ShallowRenderer()
    renderer.render(<Member member={{
      id: '4',
      name: 'Bonk Gundsdottir',
      avatarUrl: 'bonk.jpg',
      bio: 'A sordid history.',
      location: 'Reykjavik'
    }} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })
})

describe('componentDidUpdate', () => {
  let instance, props

  beforeEach(() => {
    props = {
      fetchMembers: () => {},
      hasMore: true,
      members: [],
      networkSlug: 'wargle',
      screenProps: { currentTabName: 'Members' },
      search: 'bargle',
      slug: 'flargle',
      sortBy: 'newest'
    }
    instance = TestRenderer.create(<Members {...props} />).getInstance()
    instance.fetchOrShowCached = jest.fn()
  })

  it('does nothing if not the current tab', () => {
    instance.props.screenProps = { currentTabName: 'Flargle' }
    instance.componentDidUpdate(props)
    expect(instance.fetchOrShowCached).not.toHaveBeenCalled()
  })

  it('refreshes if slug changes', () => {
    instance.componentDidUpdate({ ...props, slug: 'aardvarks' })
    expect(instance.fetchOrShowCached).toHaveBeenCalled()
  })

  it('refreshes if networkSlug changes', () => {
    instance.componentDidUpdate({ ...props, networkSlug: 'aardvarks' })
    expect(instance.fetchOrShowCached).toHaveBeenCalled()
  })

  it('refreshes if sortBy changes', () => {
    instance.componentDidUpdate({ ...props, sortBy: 'aardvarks' })
    expect(instance.fetchOrShowCached).toHaveBeenCalled()
  })

  it('refreshes if search changes', () => {
    instance.componentDidUpdate({ ...props, search: 'aardvarks' })
    expect(instance.fetchOrShowCached).toHaveBeenCalled()
  })

  it('does not refresh if nothing changes', () => {
    instance.componentDidUpdate(props)
    expect(instance.fetchOrShowCached).not.toHaveBeenCalled()
  })

  it('refreshes when switching to Members tab', () => {
    const screenProps = { currentTabName: 'Home' }
    instance.componentDidUpdate({ ...props, screenProps })
    expect(instance.fetchOrShowCached).toHaveBeenCalled()
  })
})

describe('Banner', () => {
  it('returns null if community and all are both falsy', () => {
    expect(Banner({})).toBe(null)
  })
})
