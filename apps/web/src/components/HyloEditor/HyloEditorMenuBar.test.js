import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import HyloEditorMenuBar from './HyloEditorMenuBar'

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

function mockEditor () {
  const chain = { focus: jest.fn(), command: jest.fn(), insertContent: jest.fn(), run: jest.fn() }
  chain.focus.mockReturnValue(chain)
  chain.command.mockReturnValue(chain)
  chain.insertContent.mockReturnValue(chain)
  return { editor: { chain: () => chain, isActive: () => false, getAttributes: () => ({}) }, chain }
}

function pickEmoji () {
  fireEvent.click(screen.getByTestId('editor-toolbar-emoji-button'))
  fireEvent.click(screen.getByText('pick party'))
}

describe('HyloEditorMenuBar emoji button', () => {
  afterEach(() => mockFinePointer(false))

  it('is not shown on touch devices', () => {
    mockFinePointer(false)
    render(<HyloEditorMenuBar editor={mockEditor().editor} />)
    expect(screen.queryByTestId('editor-toolbar-emoji-button')).not.toBeInTheDocument()
  })

  it('inserts the chosen emoji at the editor cursor', () => {
    mockFinePointer(true)
    const { editor, chain } = mockEditor()
    render(<HyloEditorMenuBar editor={editor} />)
    pickEmoji()
    expect(chain.insertContent).toHaveBeenCalledWith('🎉')
    expect(chain.run).toHaveBeenCalled()
    // Starts a new undo group so Cmd-Z removes just the emoji
    const tr = { setMeta: jest.fn() }
    expect(chain.command.mock.calls[0][0]({ tr })).toBe(true)
    expect(tr.setMeta).toHaveBeenCalled()
  })

  it('hands the emoji to onInsertEmoji when given', () => {
    mockFinePointer(true)
    const { editor, chain } = mockEditor()
    const onInsertEmoji = jest.fn()
    render(<HyloEditorMenuBar editor={editor} onInsertEmoji={onInsertEmoji} />)
    pickEmoji()
    expect(onInsertEmoji).toHaveBeenCalledWith('🎉')
    expect(chain.insertContent).not.toHaveBeenCalled()
  })
})
