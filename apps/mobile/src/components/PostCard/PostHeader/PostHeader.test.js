import 'react-native'
import React from 'react'
import orm from 'store/models'

import ReactShallowRenderer from 'react-test-renderer/shallow'
import PostHeader, { PostMenu, PostLabel } from './PostHeader'
import { render } from '@testing-library/react-native'
import { createInitialStateWithCurrentUser, TestRoot } from 'util/testing'

jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  withTranslation: () => Component => {
    Component.defaultProps = { ...Component.defaultProps, t: (str) => str }
    return Component
  },
  useTranslation: (domain) => {
    return {
      t: (str) => str,
      i18n: {
        changeLanguage: () => new Promise(() => {})
      }
    }
  }
}))

let state, requiredProps
beforeAll(() => {
  const session = orm.session(orm.getEmptyState())
  const group = session.Group.create({ id: '99', slug: 'foo', name: 'foo' })
  const group2 = session.Group.create({ id: '100', slug: 'bar', name: 'bar' })
  const commonRoleCoordinator = session.CommonRole.create({ id: 1, name: 'Coordinator', responsibilities: [{ id: 1, name: 'Administration' }] })

  session.LinkPreview.create({
    id: 1
  })

  session.Me.create({
    id: '1',
    memberships: [
      session.Membership.create({
        id: '345',
        group: group.id
      }),
      session.Membership.create({
        id: '678',
        group: group2.id,
        commonRoles: { items: [] }
      })
    ],
    groupRoles: {
      items: []
    },
    membershipCommonRoles: {
      items: [
        {
          id: 1,
          groupId: group.id,
          commonRoleId: commonRoleCoordinator.id,
          userId: 1
        }
      ]
    }
  })

  state = {
    orm: session.state,
    session: {
      groupSlug: 'foo'
    },
    PostEditor: {
      linkPreviewStatus: false
    },
    pending: {
      FETCH_LINK_PREVIEW: false
    }
  }
  requiredProps = {
    match: {},
    location: {
      search: ''
    }
  }
})

// it('renders correctly with all=true, and no group or user', () => {
//   const creator = {
//     id: 24,
//     name: 'Zeus',
//     tagline: 'Go!',
//     avatarUrl: 'foo.png'
//   }
//   const { toJSON } = render(
//     <TestRoot state={state}>
//       <PostHeader
//         creator={creator}
//         postId={22}
//         pinned
//         t={string => string}
//         topics={[{ id: '1', name: 'topic1' }, { id: '2', name: 'topic2' }]}
//         date={new Date(new Date().getTime() - 60000 * 10)}
//       />
//     </TestRoot>
//   )
//   expect(toJSON()).toMatchSnapshot()
// })

// it('renders correctly with a current user', () => {
//   const creator = {
//     id: 'current-user-id',
//     name: 'Zeus',
//     tagline: 'Go!',
//     avatarUrl: 'foo.png'
//   }
//   const { toJSON } = render(
//     <TestRoot state={createInitialStateWithCurrentUser()}>
//       <PostHeader
//         creator={creator}
//         pinned={false}
//         postId={20}
//         date={new Date(new Date().getTime() - 60000 * 10)}
//       />
//     </TestRoot>
//   )
//   expect(toJSON()).toMatchSnapshot()
// })

describe('PostLabel', () => {
  it('renders', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<PostLabel type='request' />)

    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
