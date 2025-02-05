import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import Badge from './component'

describe('Badge', () => {
  it('renders the badge with the correct number', () => {
    render(<Badge number={7} expanded onClick={() => {}} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('does not render when number is falsy', () => {
    const { container } = render(<Badge number={0} expanded onClick={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('applies the correct classes when expanded', () => {
    render(<Badge number={5} expanded onClick={() => {}} />)
    const badge = screen.getByText('5')
    expect(badge).toHaveClass('badgeNumber')
    expect(badge.parentElement).toHaveClass('badge')
  })

  it('applies the correct classes when collapsed', () => {
    render(<Badge number={5} expanded={false} onClick={() => {}} />)
    const badge = screen.getByText('5')
    expect(badge).toHaveClass('badgeNumberCollapsed')
    expect(badge.parentElement).toHaveClass('badgeCollapsed')
  })

  it('applies border class when border prop is true', () => {
    render(<Badge number={5} expanded border onClick={() => {}} />)
    const badge = screen.getByText('5').parentElement
    expect(badge).toHaveClass('border')
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Badge number={5} expanded onClick={handleClick} />)
    fireEvent.click(screen.getByText('5'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
