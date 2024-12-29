import React from 'react'
import { render, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ScrollListener from './ScrollListener'

describe('ScrollListener', () => {
  it('calls onLeaveTop when scrolling down', () => {
    const onLeaveTop = jest.fn()

    const { getByTestId } = render(
      <div id='scroll-container' data-testid='scroll-container'>
        <ScrollListener elementId='scroll-container' onLeaveTop={onLeaveTop} />
      </div>
    )

    const container = getByTestId('scroll-container')
    container.scrollTop = 1
    fireEvent.scroll(container)

    expect(onLeaveTop).toHaveBeenCalled()
  })

  it('calls onTop when scrolling to the top', async () => {
    const onTop = jest.fn()
    const onLeaveTop = jest.fn()

    const { getByTestId } = render(
      <div id='scroll-container' data-testid='scroll-container'>
        Hello mellow
        jello wello
        hjkhjkdshf
        <ScrollListener elementId='scroll-container' onTop={onTop} onLeaveTop={onLeaveTop} />
      </div>
    )

    const container = getByTestId('scroll-container')
    container.scrollTop = 100
    fireEvent.scroll(container)
    await waitFor(() => {
      expect(onLeaveTop).toHaveBeenCalled()
    })
    container.scrollTop = 0

    // Wait 100ms before firing second scroll event
    await new Promise(resolve => setTimeout(resolve, 100))

    fireEvent.scroll(container)
    expect(onTop).toHaveBeenCalled()
  })

  // Add more tests for onBottom, onLeaveBottom, etc.
})
