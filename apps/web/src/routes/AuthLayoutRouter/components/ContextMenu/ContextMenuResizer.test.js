import React from 'react'
import { render, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ContextMenuResizer from './ContextMenuResizer'

describe('ContextMenuResizer', () => {
  let menuEl

  beforeEach(() => {
    class ResizeObserverMock {
      observe () {}
      disconnect () {}
    }
    window.ResizeObserver = ResizeObserverMock

    menuEl = document.createElement('div')
    menuEl.getBoundingClientRect = () => ({
      right: 300,
      top: 44,
      height: 700,
      left: 0,
      bottom: 744,
      width: 300,
      x: 0,
      y: 44
    })
  })

  it('spans the menu height instead of the full viewport', async () => {
    const { container } = render(<ContextMenuResizer menuEl={menuEl} />)

    await waitFor(() => {
      expect(container.querySelector('[role="separator"]')).toBeInTheDocument()
    })

    const strip = container.querySelector('[role="separator"]')
    expect(strip.style.top).toBe('44px')
    expect(strip.style.height).toBe('700px')
    expect(strip.style.left).toBe('300px')
    expect(strip.className).not.toMatch(/\btop-0\b/)
    expect(strip.className).not.toMatch(/\bbottom-0\b/)
  })
})
