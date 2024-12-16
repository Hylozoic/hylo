import React from 'react'
import { faker } from '@faker-js/faker'
import { fakePerson } from 'util/testing/testData'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { createStore } from 'redux'
import { Provider } from 'react-redux'
import Router, { Route, Routes, useParams } from 'react-router-dom'
import GroupSidebar, {
  MemberSection,
  GroupStewardsSection,
  GroupSteward
} from './GroupSidebar'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION, RESP_REMOVE_MEMBERS } from 'store/constants'
import orm from 'store/models'

function testProviders () {
  const session = orm.session(orm.getEmptyState())
  session.CommonRole.create({ id: '1', title: 'Coordinator', responsibilities: { items: [{ id: '1', title: 'Administration' }, { id: '2', title: 'Manage Content' }] } })
  const me = session.Me.create({
    id: '1',
    membershipCommonRoles: { items: [{ commonRoleId: '1', groupId: '1' }] },
    memberships: [
      session.Membership.create({
        id: '1',
        group: '1'
      })
    ]
  })
  session.Person.create({
    id: '1',
    membershipCommonRoles: [{ commonRoleId: '1', groupId: '1' }],
    memberships: [
      session.Membership.create({
        id: '1',
        group: '1'
      })
    ]
  })

  session.Group.create({
    id: '1',
    name: 'A Great Cause',
    slug: 'great-cause',
    description: 'the description, which is long enough to add a "Read More" button, '.repeat(5),
    purpose: 'To do great things',
    memberCount: 56,
    members: [me],
    stewards: ['1']
  })

  const reduxState = { orm: session.state }

  return AllTheProviders(reduxState)
}

describe('GroupSidebar', () => {
  it('renders correctly', () => {
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'great-cause' })

    render(
      <GroupSidebar />,
      { wrapper: testProviders() }
    )

    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Group Settings')).toBeInTheDocument()
  })
})

describe('MemberSection', () => {
  faker.seed(33)
  const n = 8
  const members = fakePerson(n)

  it("Doesn't show total if it's < 1", () => {
    render(
      <MemberSection
        slug='foo'
        members={members}
        memberCount={n}
        canInvite
      />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.queryByText('+')).not.toBeInTheDocument()
  })

  it("Formats total correctly if it's > 999", () => {
    render(
      <MemberSection
        slug='foo'
        members={members}
        memberCount={5600}
      />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByText('+5.6k')).toBeInTheDocument()
  })

  it('Shows invite link if has responsibility ADD_MEMBERS is true', () => {
    render(
      <MemberSection
        slug='foo'
        members={members}
        memberCount={5600}
        canInvite
      />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByText('Invite People')).toBeInTheDocument()
  })
})

describe('GroupStewardsSection', () => {
  it('renders correctly', async () => {
    const n = 5
    const stewards = fakePerson(n)
    render(
      <GroupStewardsSection stewards={stewards} descriptor='Wizard' />,
      { wrapper: AllTheProviders() }
    )

    // TODO: figure out how to test the translation named values working
    expect(await screen.findByText('Group Wizard')).toBeInTheDocument()
  })
})

describe('GroupSteward', () => {
  it('renders correctly', async () => {
    const steward = {
      id: 1,
      name: 'Jon Smith',
      avatarUrl: 'foo.png',
      commonRoles: { items: [] },
      groupRoles: { items: [] }
    }
    render(
      <GroupSteward steward={steward} />,
      { wrapper: AllTheProviders() }
    )
    expect(await screen.findByText(steward.name)).toBeInTheDocument()
  })
})
