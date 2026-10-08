import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import SearchPage, { TabBar, Tab, SearchResult, PersonCard, PostCard, CommentCard } from './SearchPage'

jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

describe('SearchPage', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      searchResults: [1, 2, 3],
      searchTerm: 'how',
      setSearchTerm: () => {},
      pending: true,
      goToPost: () => {},
      goToPerson: () => {},
      filter: 'post',
      setSearchFilter: () => {}
    }

    renderer.render(<SearchPage {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  describe('fetchMore', () => {
    it('calls fetchMoreSearchResults when not pending', () => {
      const props = {
        fetchSearchResults: () => {},
        fetchMoreSearchResults: jest.fn(),
        pending: false
      }
      const instance = ReactTestRenderer.create(<SearchPage {...props} />).getInstance()
      instance.fetchMore({ sendPushNotifications: true })
      expect(props.fetchMoreSearchResults).toHaveBeenCalled()
    })

    it("doesn't call fetchMoreSearchResults when pending", () => {
      const props = {
        fetchSearchResults: () => {},
        fetchMoreSearchResults: jest.fn(),
        pending: true
      }
      const instance = ReactTestRenderer.create(<SearchPage {...props} />).getInstance()
      instance.fetchMore({ sendPushNotifications: true })
      expect(props.fetchMoreSearchResults).not.toHaveBeenCalled()
    })
  })
})

describe('TabBar', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      filter: 'post',
      setSearchFilter: () => {}
    }

    renderer.render(<TabBar {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('Tab', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      id: 'post',
      label: 'Discussions',
      filter: 'post',
      setSearchFilter: () => {}
    }

    renderer.render(<Tab {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('SearchResult', () => {
  const defaultProps = {
    goToPost: () => {},
    goToPerson: () => {}
  }

  it('works with Person', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      ...defaultProps,
      searchResult: {
        type: 'Person',
        content: { id: 1 }
      }
    }

    renderer.render(<SearchResult {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('works with Post', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      ...defaultProps,
      searchResult: {
        type: 'Post',
        content: { id: 1 }
      }
    }

    renderer.render(<SearchResult {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('works with Comment', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      ...defaultProps,
      searchResult: {
        type: 'Comment',
        content: { id: 1 }
      }
    }

    renderer.render(<SearchResult {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('PersonCard', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      person: {
        id: 1,
        name: 'Jo',
        avatarUrl: 'jo.png',
        location: 'Spain'
      },
      goToPerson: () => {}
    }

    renderer.render(<PersonCard {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('PostCard', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      post: {
        id: 1,
        creator: {
          id: 2
        }
      },
      goToPost: () => {}
    }

    renderer.render(<PostCard {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('CommentCard', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      comment: {
        id: 1,
        post: {
          id: 2,
          creator: {
            id: 3
          },
          createdAt: 123,
          type: 'singalong',
          pinned: false,
          announcement: false,
          title: 'Yallow'
        }
      },
      goToPost: () => {}
    }

    renderer.render(<CommentCard {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
