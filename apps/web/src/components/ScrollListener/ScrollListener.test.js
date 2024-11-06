import React from 'react'
import { render, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import ScrollListener from './ScrollListener'

describe('ScrollListener', () => {
  it('calls onLeaveTop when scrolling down', () => {
    const onLeaveTop = jest.fn()
    const element = { scrollTop: 0 }

    const { getByTestId } = render(
      <div data-testid='scroll-container'>
        <ScrollListener element={element} onLeaveTop={onLeaveTop} />
      </div>
    )

    const container = getByTestId('scroll-container')
    element.scrollTop = 1
    fireEvent.scroll(container)

    expect(onLeaveTop).toHaveBeenCalled()
  })

  it('calls onTop when scrolling to the top', () => {
    const onTop = jest.fn()
    const element = { scrollTop: 1 }

    const { getByTestId } = render(
      <div data-testid='scroll-container'>
        <ScrollListener element={element} onTop={onTop} />
      </div>
    )

    const container = getByTestId('scroll-container')
    element.scrollTop = 0
    fireEvent.scroll(container)

    expect(onTop).toHaveBeenCalled()
  })

  // Add more tests for onBottom, onLeaveBottom, etc.
})
