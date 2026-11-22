import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import CardFileAttachments from './CardFileAttachments'

describe('CardFileAttachments', () => {
  it('renders a video player for an uploaded mp4 and a link for other files', () => {
    const { container } = render(
      <CardFileAttachments
        attachments={[
          { id: 1, type: 'file', url: 'https://cdn.example/uploads/clip.mp4' },
          { id: 2, type: 'file', url: 'https://cdn.example/uploads/notes.pdf' },
          { id: 3, type: 'image', url: 'https://cdn.example/uploads/photo.png' }
        ]}
      />
    )

    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'https://cdn.example/uploads/clip.mp4')
    expect(screen.getByText('notes.pdf').closest('a')).toHaveAttribute('href', 'https://cdn.example/uploads/notes.pdf')
    expect(screen.queryByText('photo.png')).not.toBeInTheDocument()
  })
})
