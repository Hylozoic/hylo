import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Dropdown from './Dropdown'

const sampleItems = [
  { label: 'item 1' },
  { label: 'item 2' }
]

describe('Dropdown', () => {
  it('renders with no items', () => {
    render(<Dropdown toggleChildren={<span>click me</span>} />)
    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('renders with items', () => {
    render(<Dropdown toggleChildren={<span>click me</span>} items={sampleItems} />)

    fireEvent.click(screen.getByText('click me'))

    expect(screen.getByText('item 1')).toBeInTheDocument()
    expect(screen.getByText('item 2')).toBeInTheDocument()
  })

  it('renders with a triangle', () => {
    render(<Dropdown toggleChildren={<span>hi</span>} items={sampleItems} triangle />)

    fireEvent.click(screen.getByText('hi'))

    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(3) // Including the triangle
    expect(listItems[1]).toHaveTextContent('item 1')
    expect(listItems[2]).toHaveTextContent('item 2')
  })

  it('renders with passed-in children', () => {
    render(
      <Dropdown toggleChildren={<span>hi</span>}>
        <li>foo</li>
        <li>bar</li>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('hi'))

    expect(screen.getByText('foo')).toBeInTheDocument()
    expect(screen.getByText('bar')).toBeInTheDocument()
  })

  it('renders with passed-in children and a triangle', () => {
    render(
      <Dropdown triangle toggleChildren={<span>hi</span>}>
        <li>foo</li>
        <li>bar</li>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('hi'))

    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(3) // Including the triangle
    expect(listItems[1]).toHaveTextContent('foo')
    expect(listItems[2]).toHaveTextContent('bar')
  })
})
