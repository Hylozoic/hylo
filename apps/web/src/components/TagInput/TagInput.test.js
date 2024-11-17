import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TagInput from './TagInput'

const defaultMinProps = {
  handleInputChange: jest.fn()
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

  describe('resetInput', () => {
    it("sets input value to '' and calls handleInputChange", () => {
      const handleInputChange = jest.fn()
      const { container } = renderComponent({ handleInputChange })

      const input = container.querySelector('input')
      fireEvent.change(input, { target: { value: 'test' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      expect(input.value).toBe('')
      expect(handleInputChange).toHaveBeenCalledWith('')
    })
  })
})
