import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import insertTextAtSelection from 'util/insertTextAtSelection'
import EmojiInsertButton from './EmojiInsertButton'

jest.mock('components/EmojiPicker/EmojiPicker', () => ({
  preventFocusSteal: (event) => event.preventDefault(),
  EmojiPickerContent: ({ onEmojiSelect }) => (
    <button type='button' onClick={() => onEmojiSelect({ native: '🎉' })}>pick party</button>
  )
}))

function mockFinePointer (matches) {
  window.matchMedia.mockImplementation(query => ({
    matches: matches && query === '(hover: hover) and (pointer: fine)',
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
}

describe('insertTextAtSelection', () => {
  it('inserts at the cursor', () => {
    expect(insertTextAtSelection('Hello world', 5, 5, '🎉')).toEqual({ value: 'Hello🎉 world', caret: 7 })
  })

  it('replaces the selected text', () => {
    expect(insertTextAtSelection('Hello world', 6, 11, '🌍')).toEqual({ value: 'Hello 🌍', caret: 8 })
  })

  it('appends when there is no selection', () => {
    expect(insertTextAtSelection('Hi', null, null, '👋')).toEqual({ value: 'Hi👋', caret: 4 })
    expect(insertTextAtSelection(undefined, undefined, undefined, '👋')).toEqual({ value: '👋', caret: 2 })
  })
})

describe('EmojiInsertButton', () => {
  afterEach(() => mockFinePointer(false))

  it('is not shown on touch devices', () => {
    mockFinePointer(false)
    render(<EmojiInsertButton onSelect={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Add emoji' })).not.toBeInTheDocument()
  })

  it('opens the picker and passes the chosen emoji to onSelect on mouse devices', () => {
    mockFinePointer(true)
    const onSelect = jest.fn()
    render(<EmojiInsertButton onSelect={onSelect} />)
    const trigger = screen.getByRole('button', { name: 'Add emoji' })

    // Pressing the trigger must not take focus from the field being edited
    expect(fireEvent.mouseDown(trigger)).toBe(false)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('pick party'))
    expect(onSelect).toHaveBeenCalledWith('🎉')
    expect(screen.queryByText('pick party')).not.toBeInTheDocument()
  })
})
