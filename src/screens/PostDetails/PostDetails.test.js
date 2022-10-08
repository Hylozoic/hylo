import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import TestRenderer, { act } from 'react-test-renderer'
import { PostDetails, JoinProjectButton } from './PostDetails'
import { TestRoot } from 'util/testing'
import MockedScreen from 'util/testing/MockedScreen'
import orm from 'store/models'

// TODO: Fix tests to have test Redux store for Redux hooks:
//       https://gist.github.com/krawaller/e5d40217658fa132f3c3904987e467cd

jest.mock('components/SocketSubscriber', () => () => null)
jest.mock('store/selectors/getCurrentGroupId', () => () => 'public')

const post = {
  id: '91',
  creator: {
    id: '77',
    name: 'Houdini'
  },
  groups: [{ slug: 'foom' }],
  createdAt: '2017-05-19T23:24:58Z',
  imageUrls: ['foom.png'],
  title: 'Hi',
  details: 'Lo',
  commenters: [{ id: 9, name: 'Jebobo Crustacean' }, { id: 7, name: 'Lobster Science' }],
  commentsTotal: 12,
  votesTotal: 8,
  myVote: true,
  type: 'request',
  fileUrls: [
    'http://foo.com/foo.pdf',
    'http://foo.com/bar.zip'
  ],
  pinned: true,
  topics: [
    { name: 'topic1', id: '1' }
  ]
}
const currentUser = {
  id: 123,
  avatarUrl: 'me.png',
  firstName: () => 'Joe'
}

const props = {
  post,
  currentUser,
  editPost: jest.fn(),
  pending: false,
  fetchPost: jest.fn(),
  showMember: jest.fn(),
  showTopic: jest.fn(),
  createComment: jest.fn(async () => ({ success: true })),
  goToGroup: jest.fn(),
  navigation: {
    setOptions: jest.fn(),
    setParams: jest.fn(),
    getParam: jest.fn()
  }
}

const state = {
  orm: orm.getEmptyState(),
  queryResults: {},
  pending: {},
  session: {}
}

describe('PostDetails', () => {
  it('renders correctly', () => {
    const renderer = TestRenderer.create(
      <TestRoot state={state}>
        <MockedScreen>
          {() => <PostDetails {...props} />}
        </MockedScreen>
      </TestRoot>
    )
    expect(renderer.toJSON()).toMatchSnapshot()
  })

  it('handleCreateComment success', async () => {
    const renderer = TestRenderer.create(
      <TestRoot state={state}>
        <MockedScreen>
          {() => <PostDetails {...props} />}
        </MockedScreen>
      </TestRoot>
    )
    const instance = renderer.root.findByType(PostDetails).instance
    const commentText = 'some text [amention](0) #topic 😂 <shouldn\'t encode entities>'
    instance.setState({ commentText })
    await act(async () => (
      instance.handleCreateComment(commentText)
    ))
    expect(props.createComment).toHaveBeenCalledWith({
      text: '<p>some text <span data-type="mention" class="mention" data-id="0" data-label="amention">amention</span> <span data-type="topic" class="topic" data-id="topic" data-label="#topic">#topic</span> 😂 &lt;shouldn&#39;t encode entities&gt;</p>\n',
      parentCommentId: null
    })
    expect(instance.state.submitting).toBeFalsy()
    expect(instance.state.commentText).toBe('')
  })

  it('handleCreateComment rejection', async () => {
    const rejectionProps = {
      ...props,
      createComment: jest.fn(() => Promise.resolve({ error: new Error('blah') }))
    }
    const renderer = TestRenderer.create(
      <TestRoot state={state}>
        <MockedScreen>
          {() => <PostDetails {...rejectionProps} />}
        </MockedScreen>
      </TestRoot>
    )
    const instance = renderer.root.findByType(PostDetails).instance
    const commentText = 'some text [amention:0] #topic <some encoded stuff>'
    await act(async () => {
      await instance.setState({ commentText })
      await instance.handleCreateComment(commentText)
    })
    expect(instance.state.submitting).toBeFalsy()
    expect(instance.state.commentText).toBe(commentText)
  })

  it('handleCommentOnChange', async () => {
    const renderer = TestRenderer.create(
      <TestRoot state={state}>
        <MockedScreen>
          {() => <PostDetails {...props} />}
        </MockedScreen>
      </TestRoot>
    )
    const instance = renderer.root.findByType(PostDetails).instance
    const commentText = 'some text [amention:0] #topic <some encoded stuff>'
    await act(async () => {
      await instance.setState({ commentText })
      await instance.handleCommentOnChange('something or nothing')
    })
    expect(instance.state.commentText).toEqual('something or nothing')
  })
})

describe('JoinProjectButton', () => {
  it('renders as expected', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <JoinProjectButton onPress={() => {}} />
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })

  it('renders as expected when leaving', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <JoinProjectButton onPress={() => {}} leaving />
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })
})
