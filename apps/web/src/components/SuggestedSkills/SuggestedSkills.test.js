import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import SuggestedSkills from './SuggestedSkills'
import { addSkill, removeSkill } from 'components/SkillsSection/SkillsSection.store'

const mockDispatch = jest.fn()

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('components/SkillsSection/SkillsSection.store', () => ({
  addSkill: jest.fn((name) => ({ type: 'ADD_SKILL', meta: { skillName: name } })),
  removeSkill: jest.fn((id) => ({ type: 'REMOVE_SKILL', meta: { skillId: id } }))
}))

describe('SuggestedSkills', () => {
  const group = {
    name: 'Test Group',
    suggestedSkills: [
      { id: '1', name: 'gardening' },
      { id: '2', name: 'facilitation' }
    ]
  }
  const currentUser = {
    skills: {
      toRefArray: () => []
    }
  }

  beforeEach(() => {
    mockDispatch.mockClear()
    addSkill.mockClear()
    removeSkill.mockClear()
  })

  it('dispatches addSkill when a pill is clicked', () => {
    render(<SuggestedSkills currentUser={currentUser} group={group} />)

    fireEvent.click(screen.getByText('gardening'))

    expect(addSkill).toHaveBeenCalledWith('gardening')
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'ADD_SKILL', meta: { skillName: 'gardening' } })
  })

  it('dispatches removeSkill when a selected pill is clicked', () => {
    const userWithSkill = {
      skills: {
        toRefArray: () => [{ id: '1', name: 'gardening' }]
      }
    }
    render(<SuggestedSkills currentUser={userWithSkill} group={group} />)

    fireEvent.click(screen.getByText('gardening'))

    expect(removeSkill).toHaveBeenCalledWith('1')
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REMOVE_SKILL', meta: { skillId: '1' } })
  })
})
