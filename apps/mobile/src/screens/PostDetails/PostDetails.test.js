import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import PostDetails from './PostDetails'
import { TestRoot } from 'util/testing'
import MockedScreen from 'util/testing/MockedScreen'
import extractModelsForTest from 'util/testing/extractModelsFromAction'
import orm from 'store/models'

const currentUser = {
  id: 123,
  name: 'Houdini Magic',
  avatarUrl: 'me.png'
}

const post = {
  id: '91',
  creator: {
    id: 123,
    name: 'Houdini Magic',
    avatarUrl: 'me.png'
  },
  groups: [
    { id: '1', slug: 'foom' }
  ],
  createdAt: '2017-05-19T23:24:58Z',
  imageUrls: ['foom.png'],
  title: 'Hi',
  details: 'Lo',
  peopleReactedTotal: 0,
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

jest.mock('components/SocketSubscriber', () => () => null)
jest.mock('react-native-share', () => ({
  default: jest.fn()
}))
jest.mock('urql-shared/hooks/useHyloQuery', () => ({
  __esModule: true, // This line is necessary for ES modules
  default: jest.fn().mockReturnValue([{ fetching: false, error: false }])
}))
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: jest.fn(),
    setOptions: jest.fn()
  }),
  useRoute: () => ({
    params: {
      id: post.id
    }
  })
}))

let state

describe('PostDetails', () => {
  beforeAll(() => {
    const session = orm.session(orm.getEmptyState())

    extractModelsForTest({ me: currentUser }, 'Me', session)
    extractModelsForTest({ post }, 'Post', session)

    state = {
      orm: session.state,
      pending: {}
    }
  })

  it('renders correctly', async () => {
    let renderer
    await act(() => {
      renderer = TestRenderer.create(
        <TestRoot state={state}>
          <MockedScreen>
            {() => <PostDetails />}
          </MockedScreen>
        </TestRoot>
      )
    })

    expect(renderer.toJSON()).toMatchSnapshot()
  })
})
