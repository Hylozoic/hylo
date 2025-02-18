import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import TopicSupportComingSoon from './index'

describe('TopicSupportComingSoon', () => {
  it('renders the component with correct content', () => {
    render(
      <TopicSupportComingSoon />
    )

    // Check for the heading
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "We're working on expanding #topics to more places"
    )

    // Check for the paragraph text
    expect(screen.getByText(/In the meantime, click a topic/i)).toBeInTheDocument()

    // Check for the button
    expect(screen.getByRole('button', { name: /Return to All Groups/i })).toBeInTheDocument()

    // Check for the image
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('has a working link to the "All Groups" page', () => {
    render(
      <TopicSupportComingSoon />
    )

    const link = screen.getByRole('link', { name: /Return to All Groups/i })
    expect(link).toHaveAttribute('href', '/my/groups/stream')
  })
})
