import { TextInput } from 'react-native'
import React from 'react'
import orm from 'store/models'

import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import { simulate, TestRoot } from 'util/testing'
import { MemberList } from './MemberList'
import MockedScreen from 'util/testing/MockedScreen'
import { render } from '@testing-library/react-native'

let state
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
    PostEditor: {
      linkPreviewStatus: false
    },
    pending: {
      FETCH_LINK_PREVIEW: false
    }
  }
})

const lodash = jest.requireActual('lodash/fp')
lodash.debounce = (_, fn) => fn

describe('MemberList', () => {
  it('renders with default props with default non-server search', () => {
    const renderer = new ReactShallowRenderer()
    const testProps = {
      navigation: {},
      group: { id: 2 },
      members: [
        { id: '1', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Loren' },
        { id: '2', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Robbie' }
      ]
    }

    renderer.render(
      <TestRoot state={state}>
        <MemberList {...testProps} t={str => str} />
      </TestRoot>

    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })

  // it('sets new list members if provided members list changes', () => {
  //   const props = {
  //     group: {id: 2},
  //     members: [
  //       { id: '1', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'Member 1' },
  //       { id: '2', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'Member 2' }
  //     ]
  //   }
  //   const prevProps = {
  //     group: {id: 2},
  //     members: [
  //       { id: '1', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'Member1' },
  //       { id: '2', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'Member 2' }
  //     ]
  //   }
  //   const testRenderer = ReactTestRenderer.create(
  //     <TestRoot state={state}>
  //       <MemberList {...props} t={str => str} />
  //     </TestRoot>
  //   )

  //   console.log(testRenderer.toJSON(), 'DADADDADADADADDD')
  //   const instance = testRenderer.root.findByType(MemberList).instance

  //   instance.setState = jest.fn()
  //   instance.componentDidUpdate(props)
  //   expect(instance.setState).not.toHaveBeenCalled()
  //   instance.setState = jest.fn()
  //   instance.componentDidUpdate(prevProps)
  //   expect(instance.setState).toHaveBeenCalledWith(props)
  // })

  // it('runs search when typing', () => {
  //   const props = {
  //     group: {id: 2},
  //     members: [
  //       { id: '1', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'asdf' },
  //       { id: '2', groupRoles: {items: []}, membershipCommonRoles: {items: []}, name: 'hjkl' }
  //     ]
  //   }
  //   const renderer = ReactTestRenderer.create(
  //     <TestRoot state={state}>
  //       <MemberList {...props} t={str => str} />
  //     </TestRoot>
  //   )
  //   const searchField = renderer.root.findByType(TextInput)
  //   const instance = renderer.getInstance()
  //   const searchText = 'hj'

  //   instance.setState = jest.fn()
  //   simulate(searchField, 'changeText', searchText)
  //   expect(instance.setState).toHaveBeenCalledWith({
  //     members: [props.members[1]]
  //   })
  // })

  describe('server search', () => {
    it('fetches new results when search provided', () => {
      const testProps = {
        isServerSearch: true,
        search: 'test',
        fetchMembers: jest.fn(() => ([])),
        isFocused: true
      }

      const { toJSON } = render(
        <TestRoot state={state}>
          <MockedScreen>
            {screenProps => {
              return <MemberList {...screenProps} {...testProps} t={str => str} />
            }}
          </MockedScreen>
        </TestRoot>
      )
      expect(testProps.fetchMembers).toHaveBeenCalled()
      expect(toJSON()).toMatchSnapshot()
    })
  })

  it('sets search when typing', () => {
    const props = {
      isServerSearch: true,
      setSearch: jest.fn()
    }
    const renderer = ReactTestRenderer.create(
      <TestRoot state={state}>
        <MemberList {...props} t={str => str} />
      </TestRoot>
    )
    const searchField = renderer.root.findByType(TextInput)
    const searchText = 'hj'

    simulate(searchField, 'changeText', searchText)
    expect(props.setSearch).toHaveBeenCalledWith(searchText)
  })

  it('runs call for new results if server search', () => {
    const renderer = new ReactShallowRenderer()
    const testProps = {
      group: { id: 2 },
      isServerSearch: true,
      members: [
        { id: '1', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Loren' },
        { id: '2', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Robbie' }
      ]
    }

    renderer.render(
      <TestRoot state={state}>
        <MemberList {...testProps} t={str => str} />
      </TestRoot>
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })
})
