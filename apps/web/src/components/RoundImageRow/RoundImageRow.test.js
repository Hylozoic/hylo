import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import RoundImageRow from './RoundImageRow'

describe('RoundImageRow', () => {
  it('displays a RoundImage for every url', () => {
    const imageUrls = ['1.png', '2.png', '3.png', '4.png']
    render(<RoundImageRow imageUrls={imageUrls} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(4)

    imageUrls.forEach((url, index) => {
      expect(images[index].getAttribute('style')).toContain(`background-image: url(${url})`)
    })
  })

  it('caps the number of images and shows a plus indicator when cap is provided', () => {
    const imageUrls = ['1.png', '2.png', '3.png', '4.png', '5.png']
    render(<RoundImageRow imageUrls={imageUrls} cap={3} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3)

    const plusIndicator = screen.getByText('+2')
    expect(plusIndicator).toBeInTheDocument()
  })

  it('shows correct number of images and plus indicator when count is provided', () => {
    const imageUrls = ['1.png', '2.png']
    render(<RoundImageRow imageUrls={imageUrls} count={5} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)

    const plusIndicator = screen.getByText('+3')
    expect(plusIndicator).toBeInTheDocument()
  })
})
