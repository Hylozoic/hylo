import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SkillsToLearnSection from './SkillsToLearnSection'

describe('SkillsToLearnSection', () => {
  const mockSkills = [{ id: 1, name: 'test' }, { id: 2, name: 'unclickable' }]
  const mockFetchMemberSkills = jest.fn()

  it('shows basic pills', () => {
    render(<SkillsToLearnSection skills={mockSkills} fetchMemberSkills={mockFetchMemberSkills} editable isMe/>)

    expect(screen.getByText('Add a skill you want to learn')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('unclickable')).toBeInTheDocument()
  })
})
