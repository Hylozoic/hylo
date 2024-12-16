import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Loading from './Loading'

describe('Loading component', () => {
  it('renders the loading indicator', () => {
    render(<Loading />)
    const loadingElement = screen.getByRole('img', { name: /loading/i })
    expect(loadingElement).toBeInTheDocument()
  })

  it('applies the correct class for fullscreen type', () => {
    render(<Loading type='fullscreen' />)
    const loadingContainer = screen.getByTestId('loading-container')
    expect(loadingContainer).toHaveClass('loadingFullscreen')
  })

  it('applies the correct class for inline type and sets the correct size', () => {
    render(<Loading type='inline' />)
    const loadingContainer = screen.getByTestId('loading-container')
    expect(loadingContainer).toHaveClass('loadingInline')
    const loadingElement = screen.getByRole('img', { name: /loading/i })
    expect(loadingElement).toHaveAttribute('width', '25px')
  })

  it('allows custom size to be set', () => {
    render(<Loading size={60} />)
    const loadingElement = screen.getByRole('img', { name: /loading/i })
    expect(loadingElement).toHaveAttribute('width', '60px')
  })
})
