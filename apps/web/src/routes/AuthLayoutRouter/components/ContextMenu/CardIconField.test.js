import React from 'react'
import { render, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CardIconField from './CardIconField'

const SIZE = { w: 168, h: 156 }

describe('CardIconField', () => {
  it('tiles a Lucide icon from a single pattern definition', () => {
    const { container } = render(
      <CardIconField view={{ lucideIcon: 'Activity' }} tint='#888' {...SIZE} />
    )

    const pattern = container.querySelector('pattern')
    expect(pattern).toBeInTheDocument()
    // two placements per tile give the brick stagger
    expect(pattern.querySelectorAll('use')).toHaveLength(2)
    // and the fill references that pattern rather than repeating elements
    const rect = container.querySelector('rect')
    expect(rect.getAttribute('fill')).toBe(`url(#${pattern.id})`)
  })

  it('stays far below the element-per-glyph count it replaced', () => {
    const { container } = render(
      <CardIconField view={{ lucideIcon: 'Users' }} tint='#888' {...SIZE} />
    )

    // the previous implementation rendered a 17x16 grid — 272 slots, ~1400 nodes
    expect(container.querySelectorAll('*').length).toBeLessThan(20)
  })

  it('gives each instance its own ids so cards do not share one icon', () => {
    const { container } = render(
      <>
        <CardIconField view={{ lucideIcon: 'Activity' }} tint='#888' {...SIZE} />
        <CardIconField view={{ lucideIcon: 'Users' }} tint='#888' {...SIZE} />
      </>
    )

    const [first, second] = container.querySelectorAll('pattern')
    expect(first.id).not.toBe(second.id)
  })

  it('tiles a legacy icon-font glyph as text', async () => {
    // jsdom has no stylesheet for the icon font, so stand in for the ::before rule
    const realGetComputedStyle = window.getComputedStyle
    jest.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (pseudo === '::before' && el.className === 'icon-Stream') return { content: '""' }
      return realGetComputedStyle(el, pseudo)
    })

    const { container } = render(
      <CardIconField view={{ iconName: 'Stream' }} tint='#888' {...SIZE} />
    )

    await waitFor(() => {
      expect(container.querySelector('text')).toBeInTheDocument()
    })
    expect(container.querySelector('text').getAttribute('font-family')).toBe('hylo-evo-icons')
    expect(container.querySelectorAll('use')).toHaveLength(2)

    window.getComputedStyle.mockRestore()
  })

  it('renders nothing when the view has no resolvable icon', () => {
    const { container } = render(<CardIconField view={{}} tint='#888' {...SIZE} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ignores a lucide name that is not a real icon', () => {
    const { container } = render(
      <CardIconField view={{ lucideIcon: 'NotARealIcon' }} tint='#888' {...SIZE} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
