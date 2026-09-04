import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SkillsSection from '../SkillsSection/SkillsSection'

describe('SkillsToLearnSection', () => {
  const mockSkills = [{ id: 1, name: 'test' }, { id: 2, name: 'unclickable' }]

  it('shows basic pills', () => {
    render(
      <SkillsSection
        skills={mockSkills}
        loading={false}
        editable
        isMe
        label='Add a skill you want to learn'
        placeholder='What skills do you want to learn?'
        addSkill={jest.fn()}
        removeSkill={jest.fn()}
        fetchMemberSkills={jest.fn()}
        fetchSkillSuggestions={jest.fn()}
        setSearch={jest.fn()}
        searchForSkill={jest.fn()}
        skillSuggestions={[]}
        search=''
      />
    )

    expect(screen.getByText('Add a skill you want to learn')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('unclickable')).toBeInTheDocument()
  })
})
