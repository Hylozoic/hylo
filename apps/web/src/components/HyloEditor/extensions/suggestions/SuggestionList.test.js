/* eslint-env jest */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import SuggestionList from './SuggestionList'

jest.mock('react-intersection-observer', () => ({ useInView: () => ({ ref: jest.fn(), inView: false }) }))

describe('SuggestionList', () => {
  it('takes Enter to pick the highlighted suggestion', () => {
    const command = jest.fn()
    const ref = React.createRef()
    const items = [
      { id: '1', label: 'Ann', suggestionLabel: 'Ann' },
      { id: '2', label: 'Bo', suggestionLabel: 'Bo' }
    ]
    render(<SuggestionList ref={ref} items={{ items, hasMore: false }} command={command} />)
    expect(screen.getByText('Ann')).toBeInTheDocument()

    let handled
    act(() => { handled = ref.current.onKeyDown({ event: { key: 'ArrowDown' } }) })
    act(() => { handled = ref.current.onKeyDown({ event: { key: 'Enter' } }) })

    expect(handled).toBe(true)
    expect(command).toHaveBeenCalledWith(items[1])
  })

  it('keeps Enter while results are still loading', () => {
    const command = jest.fn()
    const ref = React.createRef()
    render(<SuggestionList ref={ref} items={{ items: [], loading: true }} command={command} />)

    expect(ref.current.onKeyDown({ event: { key: 'Enter' } })).toBe(true)
    expect(command).not.toHaveBeenCalled()
  })
})
