import React from 'react'
import { render } from 'util/testing/reactTestingLibraryExtended'
import MemberReactions from './MemberReactions'

jest.mock('./MemberReactions.store', () => {
  const noReactions = []
  return {
    getMemberReactions: jest.fn(() => noReactions),
    fetchMemberReactions: jest.fn(() => ({ type: 'FETCH_MEMBER_REACTIONS' }))
  }
})

describe('MemberReactions', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemberReactions />)
    expect(container).toBeTruthy()
  })
})
