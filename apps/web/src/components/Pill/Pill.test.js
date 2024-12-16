import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import Pill from './Pill'

describe('Pill', () => {
  it('renders with correct label', () => {
    render(<Pill id={1} label='mountain climbing' />)
    expect(screen.getByText('mountain climbing')).toBeInTheDocument()
  })

  it('renders as editable with remove icon', () => {
    render(<Pill id={1} label='mountain climbing' editable />)
    expect(screen.getByText('mountain climbing')).toBeInTheDocument()
    expect(screen.getByTestId('pill-remove-icon')).toBeInTheDocument()
  })

  it('calls onRemove when double-clicked', () => {
    const onRemove = jest.fn()
    render(<Pill id={1} label='mountain climbing' editable onRemove={onRemove} />)

    const removeIcon = screen.getByTestId('pill-remove-icon')
    fireEvent.click(removeIcon)
    fireEvent.click(removeIcon)

    expect(onRemove).toHaveBeenCalledWith(1, 'mountain climbing')
  })

  it('shows tooltip on hover', async () => {
    render(<Pill id={1} label='mountain climbing' tooltipContent='Custom tooltip' />)

    const pillLabel = screen.getByText('mountain climbing')
    fireEvent.mouseEnter(pillLabel)

    const tooltip = await screen.findByText('Custom tooltip')
    expect(tooltip).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<Pill id={1} label='mountain climbing' onClick={onClick} />)

    const pillLabel = screen.getByText('mountain climbing')
    fireEvent.click(pillLabel)

    expect(onClick).toHaveBeenCalledWith(1, 'mountain climbing')
  })
})
