import { renderHook } from '@testing-library/react'
import { themes, defaultTheme } from '../themes'
import useGroupTheme from './useGroupTheme'

let mockMe = { settings: { theme: 'forest' } }
let mockColorScheme = 'light'

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: () => mockMe
}))

jest.mock('hooks/useAppearance', () => () => ({ effectiveColorScheme: mockColorScheme }))

const themedGroup = {
  settings: {
    theme: {
      light: { background: '150 22% 88%' },
      dark: { background: '160 18% 12%' },
      radius: 'xl'
    }
  }
}

describe('useGroupTheme', () => {
  beforeEach(() => {
    mockMe = { settings: { theme: 'forest' } }
    mockColorScheme = 'light'
    document.body.removeAttribute('style')
  })

  it('does nothing for a group without a theme', () => {
    const { result } = renderHook(() => useGroupTheme({ settings: { layout: 'default' } }))
    expect(result.current.hasGroupTheme).toBe(false)
    expect(result.current.globalNavStyle).toBeUndefined()
    expect(document.body.style.getPropertyValue('--background')).toEqual('')
  })

  it('does nothing when there is no group', () => {
    const { result } = renderHook(() => useGroupTheme(null))
    expect(result.current.hasGroupTheme).toBe(false)
  })

  it('sets the group tokens on the body, over the default theme', () => {
    const { result } = renderHook(() => useGroupTheme(themedGroup))
    expect(result.current.hasGroupTheme).toBe(true)
    expect(document.body.style.getPropertyValue('--background')).toEqual('150 22% 88%')
    expect(document.body.style.getPropertyValue('--foreground')).toEqual(themes[defaultTheme].light.foreground)
    expect(document.body.style.getPropertyValue('--radius')).toEqual('0.875rem')
  })

  it("gives the global nav the viewer's own theme back", () => {
    const { result } = renderHook(() => useGroupTheme(themedGroup))
    expect(result.current.globalNavStyle['--background']).toEqual(themes.forest.light.background)
    expect(result.current.globalNavStyle['--radius']).toEqual('0.5rem')
  })

  it('follows the viewer between light and dark', () => {
    const { rerender } = renderHook(() => useGroupTheme(themedGroup))
    mockColorScheme = 'dark'
    rerender()
    expect(document.body.style.getPropertyValue('--background')).toEqual('160 18% 12%')
  })

  it('removes the tokens when leaving the group', () => {
    const { rerender } = renderHook(({ group }) => useGroupTheme(group), { initialProps: { group: themedGroup } })
    expect(document.body.style.getPropertyValue('--background')).not.toEqual('')
    rerender({ group: null })
    expect(document.body.style.getPropertyValue('--background')).toEqual('')
    expect(document.body.style.getPropertyValue('--radius')).toEqual('')
  })

  it('removes the tokens on unmount', () => {
    const { unmount } = renderHook(() => useGroupTheme(themedGroup))
    unmount()
    expect(document.body.style.getPropertyValue('--background')).toEqual('')
  })

  it('ignores a theme with nothing valid in it', () => {
    const { result } = renderHook(() => useGroupTheme({ settings: { theme: { light: { background: 'url(x)' } } } }))
    expect(result.current.hasGroupTheme).toBe(false)
  })
})
