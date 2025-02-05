import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ModalSidebar from './ModalSidebar'

describe('ModalSidebar', () => {
  it('renders correctly without a theme', () => {
    const header = 'Test Header'
    const body = 'Test Body'
    render(<ModalSidebar
      header={header}
      body={body}
      onClick={jest.fn()}
           />)

    expect(screen.getByText('CLOSE')).toBeInTheDocument()
    expect(screen.getByText(header)).toBeInTheDocument()
    expect(screen.getByText(body)).toBeInTheDocument()
  })

  it('renders correctly with a theme', () => {
    const header = 'Themed Header'
    const body = 'Themed Body'
    const theme = {
      sidebarHeader: 'header-theme',
      sidebarText: 'text-theme'
    }
    render(<ModalSidebar
      header={header}
      body={body}
      onClick={jest.fn()}
      theme={theme}
           />)

    expect(screen.getByText('CLOSE')).toBeInTheDocument()
    expect(screen.getByText(header)).toHaveClass('header-theme')
    expect(screen.getByText(body)).toHaveClass('text-theme')
  })

  it('renders optional elements when provided', () => {
    const secondParagraph = 'Second Paragraph'
    const imageDialogOne = 'Image Dialog One'
    const imageDialogTwo = 'Image Dialog Two'
    const imageUrl = 'https://example.com/image.jpg'

    render(<ModalSidebar
      header='Header'
      body='Body'
      onClick={jest.fn()}
      secondParagraph={secondParagraph}
      imageDialogOne={imageDialogOne}
      imageDialogTwo={imageDialogTwo}
      imageUrl={imageUrl}
           />)

    expect(screen.getByText(secondParagraph)).toBeInTheDocument()
    expect(screen.getByText(imageDialogOne)).toBeInTheDocument()
    expect(screen.getByText(imageDialogTwo)).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-image')).toHaveStyle(`background-image: url(${imageUrl})`)
  })
})
