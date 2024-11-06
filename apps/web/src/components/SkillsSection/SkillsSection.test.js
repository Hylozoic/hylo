import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SkillsSection from './SkillsSection'

describe('SkillsSection', () => {
  const mockSkills = [
    { id: 1, name: 'test' },
    { id: 2, name: 'unclickable' }
  ]

  it('shows basic pills', () => {
    render(<SkillsSection skills={mockSkills} fetchMemberSkills={jest.fn()} />)

    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('unclickable')).toBeInTheDocument()
  })

  it('shows editable fields when isMe = true', () => {
    render(<SkillsSection skills={mockSkills} fetchMemberSkills={jest.fn()} isMe />)

    expect(screen.getByText('Add a Skill or Interest')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What skills and interests do you have?')).toBeInTheDocument()
  })
})
