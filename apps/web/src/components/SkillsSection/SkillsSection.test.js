import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import SkillsSection from './SkillsSection'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))
jest.mock('components/ui/button', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

jest.mock('./SkillsSection.store', () => ({
  addSkill: jest.fn(() => ({ type: 'ADD_SKILL' })),
  addSkillToGroup: jest.fn(() => ({ type: 'ADD_SKILL_TO_GROUP' })),
  removeSkill: jest.fn(() => ({ type: 'REMOVE_SKILL' })),
  removeSkillFromGroup: jest.fn(() => ({ type: 'REMOVE_SKILL_FROM_GROUP' })),
  fetchMemberSkills: jest.fn(() => ({ type: 'FETCH_MEMBER_SKILLS' })),
  fetchSkillSuggestions: jest.fn(() => ({ type: 'FETCH_SKILL_SUGGESTIONS' })),
  getMemberSkills: jest.fn(() => []),
  getSkillSuggestions: jest.fn(() => []),
  getSearch: jest.fn(() => ''),
  setSearch: jest.fn(() => ({ type: 'SET_SEARCH' }))
}))

describe('SkillsSection', () => {
  const mockSkills = [
    { id: 1, name: 'test' },
    { id: 2, name: 'unclickable' }
  ]

  it('shows basic pills', () => {
    render(<SkillsSection skills={mockSkills} />)

    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('unclickable')).toBeInTheDocument()
  })

  it('shows editable fields when isMe = true', async () => {
    render(<SkillsSection skills={mockSkills} isMe />)

    expect(screen.getByText('Add a Skill or Interest')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Add a Skill or Interest'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What skills and interests do you have?')).toBeInTheDocument()
    })
  })
})
