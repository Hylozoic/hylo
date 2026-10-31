import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { ConvertChatSpaceForm } from './ConvertChatSpaceModal'
import isChatOnlySpace from './isChatOnlySpace'

describe('isChatOnlySpace', () => {
  it('is true only for a space that accepts chat alone', () => {
    expect(isChatOnlySpace({ type: 'space', acceptedPostTypes: ['chat'] })).toBe(true)
    expect(isChatOnlySpace({ type: 'space', acceptedPostTypes: ['chat', 'discussion'] })).toBe(false)
    expect(isChatOnlySpace({ type: 'space', acceptedPostTypes: null })).toBe(false)
    expect(isChatOnlySpace({ acceptedPostTypes: ['chat'] })).toBe(false)
  })
})

describe('ConvertChatSpaceForm', () => {
  const preview = {
    messageCount: 412,
    authorCount: 9,
    attachmentCount: 31,
    reactionCount: 58,
    replyCount: 4
  }

  function renderForm (props = {}) {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    render(
      <ConvertChatSpaceForm
        roomName='General'
        destinationName='River City'
        preview={preview}
        previewError={null}
        loading={false}
        title='General'
        onTitleChange={jest.fn()}
        confirmName=''
        onConfirmNameChange={jest.fn()}
        submitting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...props}
      />
    )
    return { onConfirm, onCancel }
  }

  it('shows the dry-run counts and keeps convert disabled until the room name is typed', () => {
    const { onConfirm } = renderForm()

    expect(screen.getByText('412 chat posts will be converted to comments on the discussion, with 31 attachments and 58 reactions.')).toBeInTheDocument()
    expect(screen.getByText('4 comments on the chats will remain as replies to the comments.')).toBeInTheDocument()
    expect(screen.getByText('The discussion will be posted in River City')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convert' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirms once the room name matches', () => {
    const { onConfirm } = renderForm({ confirmName: 'General' })
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
