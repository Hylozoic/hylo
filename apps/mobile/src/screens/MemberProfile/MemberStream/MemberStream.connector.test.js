import { mapStateToProps, mapDispatchToProps, mergeProps } from './MemberStream.connector'
import {
  FETCH_MEMBER_POSTS, FETCH_MEMBER_COMMENTS, FETCH_MEMBER_UPVOTES, MODULE_NAME
} from './MemberStream.store'

describe('mapStateToProps', () => {
  const baseState = {
    pending: {
      [FETCH_MEMBER_POSTS]: 'pending posts',
      [FETCH_MEMBER_COMMENTS]: 'pending comments',
      [FETCH_MEMBER_UPVOTES]: 'pending upvotes'
    },
    queryResults: {}
  }

  it('sets the right values when choice is Posts', () => {
    const state = {
      ...baseState,
      [MODULE_NAME]: {
        choice: 'Posts'
      }
    }
    const { itemType, pending } = mapStateToProps(state)
    expect(itemType).toEqual('post')
    expect(pending).toEqual('pending posts')
  })

  it('sets the right values when choice is Comments', () => {
    const state = {
      ...baseState,
      [MODULE_NAME]: {
        choice: 'Comments'
      }
    }
    const { itemType, pending } = mapStateToProps(state)
    expect(itemType).toEqual('comment')
    expect(pending).toEqual('pending comments')
  })

  it('sets the right values when choice is Upvotes', () => {
    const state = {
      ...baseState,
      [MODULE_NAME]: {
        choice: 'Upvotes'
      }
    }
    const { itemType, pending } = mapStateToProps(state)
    expect(itemType).toEqual('post')
    expect(pending).toEqual('pending upvotes')
  })
})

describe('mergeProps', () => {
  const dispatchProps = {
    fetchMemberPosts: jest.fn(),
    fetchMemberComments: jest.fn(),
    fetchMemberUpvotes: jest.fn()
  }

  it('uses the fetchMemberPosts when choice is Posts', () => {
    const stateProps = {
      choice: 'Posts',
      items: [1, 2, 3],
      hasMore: true
    }
    const ownProps = { id: 34 }
    const { fetchItems, fetchMoreItems } = mergeProps(stateProps, dispatchProps, ownProps)

    fetchItems()
    expect(dispatchProps.fetchMemberPosts).toHaveBeenCalledWith({ id: 34 })
    dispatchProps.fetchMemberPosts.mockClear()

    fetchMoreItems()
    expect(dispatchProps.fetchMemberPosts).toHaveBeenCalledWith({ id: 34, offset: 3 })
  })

  it('uses the fetchMemberComments when choice is Comments', () => {
    const stateProps = {
      choice: 'Comments',
      items: [1, 2, 3],
      hasMore: true
    }
    const ownProps = { id: 34 }
    const { fetchItems, fetchMoreItems } = mergeProps(stateProps, dispatchProps, ownProps)

    fetchItems()
    expect(dispatchProps.fetchMemberComments).toHaveBeenCalledWith({ id: 34 })
    dispatchProps.fetchMemberComments.mockClear()

    fetchMoreItems()
    expect(dispatchProps.fetchMemberComments).toHaveBeenCalledWith({ id: 34, offset: 3 })
  })

  it('uses the fetchMemberUpvotes when choice is Posts', () => {
    const stateProps = {
      choice: 'Upvotes',
      items: [1, 2, 3],
      hasMore: true
    }
    const ownProps = { id: 34 }
    const { fetchItems, fetchMoreItems } = mergeProps(stateProps, dispatchProps, ownProps)

    fetchItems()
    expect(dispatchProps.fetchMemberUpvotes).toHaveBeenCalledWith({ id: 34 })
    dispatchProps.fetchMemberUpvotes.mockClear()

    fetchMoreItems()
    expect(dispatchProps.fetchMemberUpvotes).toHaveBeenCalledWith({ id: 34, offset: 3 })
  })
})

describe('mapDispatchToProps', () => {
  it('maps the action generators', () => {
    const dispatch = jest.fn(val => val)
    const props = {
      navigation: {
        navigate: jest.fn()
      }
    }
    const dispatchProps = mapDispatchToProps(dispatch, props)
    expect(dispatchProps).toMatchSnapshot()
    expect(dispatchProps.showPost(1)).toMatchSnapshot()
  })
})
