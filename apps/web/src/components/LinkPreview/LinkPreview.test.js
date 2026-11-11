import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import LinkPreview from './LinkPreview'

function renderPreview (url) {
  render(
    <MemoryRouter initialEntries={['/groups/garden/chat/general']}>
      <Routes>
        <Route path='/groups/garden/chat/general' element={<LinkPreview title='Preview' url={url} />} />
        <Route path='/groups/garden/post/42' element={<div>Post page</div>} />
      </Routes>
    </MemoryRouter>
  )
  return screen.getByRole('link', { name: 'Preview' })
}

describe('LinkPreview', () => {
  it('navigates in the app for a link to this Hylo site', () => {
    const link = renderPreview('http://localhost/groups/garden/post/42')

    expect(link).toHaveAttribute('href', '/groups/garden/post/42')
    expect(link).not.toHaveAttribute('target')

    fireEvent.click(link)
    expect(screen.getByText('Post page')).toBeInTheDocument()
  })

  it('opens other sites in a new tab', () => {
    const link = renderPreview('https://example.com/article')

    expect(link).toHaveAttribute('href', 'https://example.com/article')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('opens static marketing pages on this site in a new tab', () => {
    const link = renderPreview('http://localhost/blog/some-post')

    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders nothing for an invalid url', () => {
    const { container } = render(<LinkPreview title='Preview' url='not a url' />)
    expect(container).toBeEmptyDOMElement()
  })
})
