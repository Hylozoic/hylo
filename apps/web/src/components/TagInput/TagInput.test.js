import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TagInput from './TagInput'

const defaultMinProps = {
  handleInputChange: jest.fn(),
  t: (key) => key
}

function renderComponent (props = {}) {
  return render(
    <TagInput {...{ ...defaultMinProps, ...props }} />
  )
}

describe('TagInput', () => {
  it('renders correctly (with min props)', () => {
    renderComponent()
    expect(screen.getByPlaceholderText('Type...')).toBeInTheDocument()
  })

  it('renders correctly with tags', () => {
    const props = {
      tags: [{ name: 'one', id: 1 }, { name: 'two', id: 2 }]
    }
    renderComponent(props)
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
  })

  it('adds leading hashtags when flag is set', () => {
    const props = {
      addLeadingHashtag: true,
      tags: [{ name: 'one', id: 1 }, { name: 'two', id: 2 }]
    }
    renderComponent(props)
    expect(screen.getByText('#one')).toBeInTheDocument()
    expect(screen.getByText('#two')).toBeInTheDocument()
  })

  it('adds a suggestion on click even when parent onBlur would clear the list', () => {
    const handleAddition = jest.fn()
    const handleInputChange = jest.fn()
    const onBlur = jest.fn()
    const role = { id: '1', name: 'Coordinator' }

    renderComponent({
      handleAddition,
      handleInputChange,
      onBlur,
      suggestions: [role],
      allowNewTags: false
    })

    const suggestion = screen.getByText('Coordinator')
    fireEvent.mouseDown(suggestion)
    fireEvent.click(suggestion)

    expect(handleAddition).toHaveBeenCalledWith(role)
    expect(onBlur).not.toHaveBeenCalled()
  })
})
