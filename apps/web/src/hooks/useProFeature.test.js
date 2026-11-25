import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import useProFeature, { hasProFeature } from './useProFeature'

function Probe ({ group, feature }) {
  return <span data-testid='probe'>{String(useProFeature(group, feature))}</span>
}

describe('useProFeature', () => {
  const group = { id: '1', proFeatures: { groupThemes: true, designedViews: false } }

  it('reads a feature from the group', () => {
    render(<Probe group={group} feature='groupThemes' />)
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })

  it('is false for features the group does not have, or without a group or proFeatures', () => {
    expect(hasProFeature(group, 'designedViews')).toBe(false)
    expect(hasProFeature(group, 'recording')).toBe(false)
    expect(hasProFeature({ id: '2' }, 'groupThemes')).toBe(false)
    expect(hasProFeature(null, 'groupThemes')).toBe(false)
  })

  it('follows the Pro state: features work in grace, and are off once Pro has lapsed', () => {
    expect(hasProFeature({ ...group, proState: 'active' }, 'groupThemes')).toBe(true)
    expect(hasProFeature({ ...group, proState: 'grace' }, 'groupThemes')).toBe(true)
    expect(hasProFeature({ ...group, proState: 'lapsed' }, 'groupThemes')).toBe(false)
    expect(hasProFeature({ ...group, proState: 'none' }, 'groupThemes')).toBe(false)
  })

  it('throws for a key that is not registered', () => {
    expect(() => hasProFeature(group, 'groupTheme')).toThrow('Unknown Hylo Pro feature: groupTheme')
  })
})
