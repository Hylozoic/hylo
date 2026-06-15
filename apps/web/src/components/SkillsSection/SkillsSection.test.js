import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import SkillsSection from './SkillsSection'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))
jest.mock('components/ui/button', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

describe('SkillsSection', () => {
  const mockSkills = [
    { id: 1, name: 'test' },
    { id: 2, name: 'unclickable' }
  ]

  const controlledProps = {
    skills: mockSkills,
    fetchMemberSkills: jest.fn(),
    fetchSkillSuggestions: jest.fn(),
    setSearch: jest.fn(),
    addSkill: jest.fn(),
    removeSkill: jest.fn(),
    searchForSkill: jest.fn()
  }

  it('shows basic pills', () => {
    render(<SkillsSection {...controlledProps} />)

    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('unclickable')).toBeInTheDocument()
  })

  it('shows editable fields when isMe = true', async () => {
    render(<SkillsSection {...controlledProps} isMe />)

    expect(screen.getByText('Add a Skill or Interest')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Add a Skill or Interest'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What skills and interests do you have?')).toBeInTheDocument()
    })
  })
})
