import React from 'react'
import TestRenderer from 'react-test-renderer'
import { TestRoot } from 'util/testing'
import MockedScreen from 'util/testing/MockedScreen'
import Members from './Members'

it('renders correctly with no group (all groups default)', () => {
  const members = [
    { id: '1', groupRoles: [], membershipCommonRoles: [], name: 'Foo Lane', location: 'here', bio: 'Hello!', avatarUrl: 'foo.gif' },
    { id: '2', groupRoles: [], membershipCommonRoles: [], name: 'Bar Jones', location: 'there', bio: 'Not a stork', avatarUrl: 'bar.png' },
    { id: '3', groupRoles: [], membershipCommonRoles: [], name: 'Baz Chu', bio: 'Could be', avatarUrl: 'baz.png' },
    { id: '4', groupRoles: [], membershipCommonRoles: [], name: 'Bonk Gundsdottir', avatarUrl: 'bonk.jpg' },
    { id: '5', groupRoles: [], membershipCommonRoles: [], avatarUrl: 'woof.png' }
  ]
  const { toJSON } = TestRenderer.create(
    <TestRoot>
      <MockedScreen>
        {screenProps => (
          <Members members={members} {...screenProps} />
        )}
      </MockedScreen>
    </TestRoot>
  )

  expect(toJSON()).toMatchSnapshot()
})

it('renders with invite button when a moderator', () => {
  const members = [
    { id: '1', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Foo Lane', location: 'here', bio: 'Hello!', avatarUrl: 'foo.gif' },
    { id: '2', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Bar Jones', location: 'there', bio: 'Not a stork', avatarUrl: 'bar.png' },
    { id: '3', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Baz Chu', bio: 'Could be', avatarUrl: 'baz.png' },
    { id: '4', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, name: 'Bonk Gundsdottir', avatarUrl: 'bonk.jpg' },
    { id: '5', groupRoles: { items: [] }, membershipCommonRoles: { items: [] }, avatarUrl: 'woof.png' }
  ]
  const { toJSON } = TestRenderer.create(
    <TestRoot>
      <MockedScreen>
        {screenProps => (
          <Members canInvite group={{ allowGroupInvites: true, id: 2 }} members={members} {...screenProps} />
        )}
      </MockedScreen>
    </TestRoot>
  )

  expect(toJSON()).toMatchSnapshot()
})
