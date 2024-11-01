import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import RelatedGroupsTab, { GroupCard } from './RelatedGroupsTab'

describe('RelatedGroupsTab', () => {
  it('renders correctly', () => {
    const parentGroups = [
      { id: 9, name: 'Parent 1' },
      { id: 8, name: 'Parent 2' },
      { id: 7, name: 'Parent 3' }
    ]
    const childGroups = [
      { id: 6, name: 'Child 1' },
      { id: 5, name: 'Child 2' },
      { id: 4, name: 'Child 3' }
    ]
    const group = { id: 1, name: 'Best Group' }

    render(
      <RelatedGroupsTab
        group={group}
        parentGroups={parentGroups}
        childGroups={childGroups}
        fetchGroupToGroupJoinQuestions={() => {}}
        groupInvitesToJoinUs={[]}
        groupRequestsToJoinUs={[]}
        groupInvitesToJoinThem={[]}
        groupRequestsToJoinThem={[]}
        possibleParents={[]}
        possibleChildren={[]}
        deleteGroupRelationship={() => {}}
        inviteGroupToJoinParent={() => {}}
        requestToAddGroupToParent={() => {}}
      />
    )

    // Check for parent groups
    expect(screen.getByText('Parent Groups')).toBeInTheDocument()
    expect(screen.getByText('These are the 3 groups that Best Group is a member of')).toBeInTheDocument()
    parentGroups.forEach(parent => {
      expect(screen.getByText(parent.name)).toBeInTheDocument()
    })

    // Check for child groups
    expect(screen.getByText('Child Groups')).toBeInTheDocument()
    expect(screen.getByText('These 3 groups are members of Best Group')).toBeInTheDocument()
    childGroups.forEach(child => {
      expect(screen.getByText(child.name)).toBeInTheDocument()
    })

    // Check for buttons
    expect(screen.getByText('Join Best Group to another group')).toBeInTheDocument()
    expect(screen.getByText('Invite a group to join')).toBeInTheDocument()
  })
})

describe('GroupCard', () => {
  it('renders correctly', () => {
    const group = {
      name: 'Foom',
      avatarUrl: 'foom.png',
      numMembers: 77,
      slug: 'foom-group'
    }

    render(<GroupCard group={group} />)

    expect(screen.getByText('Foom')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Foom' })).toHaveAttribute('href', '/groups/foom-group')
    expect(screen.getByRole('img')).toHaveAttribute('src', 'foom.png')
  })
})
