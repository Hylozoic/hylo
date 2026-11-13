import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import featureFlag from 'config/featureFlags'
import { UPDATE_GROUP_THEME } from 'store/actions/updateGroupTheme'
import { themes, defaultTheme } from '../../../themes'
import { presetToDraft, prepareThemeForSave } from 'util/groupThemeEditor'
import { PREVIEW_STYLE_ID } from './useGroupThemePreview'
import AppearanceTab from './AppearanceTab'

const mockDispatch = jest.fn()

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('config/featureFlags', () => ({
  ...jest.requireActual('config/featureFlags'),
  __esModule: true,
  default: jest.fn()
}))

jest.mock('hooks/useAppearance', () => () => ({ effectiveColorScheme: 'light' }))

const savedTheme = { light: { background: '150 22% 86%' }, radius: 'xl' }

function renderTab (theme = null) {
  const group = { id: '42', settings: { layout: 'two-column', theme } }
  return render(<AppearanceTab group={group} updateGroupSettings={jest.fn()} />)
}

const previewStyle = () => document.getElementById(PREVIEW_STYLE_ID)
const saveButton = () => screen.getByRole('button', { name: 'Save theme' })

describe('AppearanceTab group theme editor', () => {
  beforeEach(() => {
    featureFlag.mockImplementation(key => key === 'GROUP_THEMES' ? 'on' : undefined)
    mockDispatch.mockReset()
    mockDispatch.mockResolvedValue({ type: UPDATE_GROUP_THEME, payload: {} })
    window.confirm = jest.fn(() => true)
  })

  it('is hidden when the GROUP_THEMES flag is off', () => {
    featureFlag.mockReturnValue(undefined)
    renderTab()
    expect(screen.getByText('Two Column')).toBeInTheDocument()
    expect(screen.queryByTestId('group-theme-editor')).not.toBeInTheDocument()
  })

  it('is shown below the layout picker when the flag is on', () => {
    renderTab()
    expect(screen.getByTestId('group-theme-editor')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('loads a preset into the draft, previews it on the page and saves it', async () => {
    renderTab()
    fireEvent.click(screen.getByTestId('group-theme-preset-snow'))

    const roleInput = screen.getByLabelText(/Background/)
    expect(roleInput.value).not.toEqual('')
    expect(previewStyle()).not.toBeNull()
    expect(previewStyle().textContent).toContain(`--background: ${themes.snow.light.background} !important`)

    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    const expected = prepareThemeForSave(presetToDraft('snow')).theme
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
    const action = mockDispatch.mock.calls[0][0]
    expect(action.type).toEqual(UPDATE_GROUP_THEME)
    expect(action.graphql.variables).toEqual({ groupId: '42', theme: expected })
    expect(await screen.findByText('Theme saved')).toBeInTheDocument()
  })

  it('previews and saves a border width, keeping it when a preset is chosen', async () => {
    renderTab()
    fireEvent.click(screen.getByTestId('group-theme-border-width-thick'))
    expect(previewStyle().textContent).toContain('--border-width: 3px !important')

    fireEvent.click(screen.getByTestId('group-theme-preset-snow'))
    fireEvent.click(saveButton())

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
    expect(mockDispatch.mock.calls[0][0].graphql.variables.theme.borderWidth).toEqual('thick')
  })

  it('shows the page in the scheme being edited and restores it afterwards', () => {
    document.documentElement.classList.add('light')
    const { unmount } = renderTab(savedTheme)
    expect(previewStyle()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(previewStyle().textContent).toContain(`--foreground: ${themes[defaultTheme].dark.foreground} !important`)

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(previewStyle()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    unmount()
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('previews and saves heading and body fonts', async () => {
    renderTab()
    await screen.findAllByRole('option', { name: 'Lora' })
    fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'Lora' } })
    fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'Inter' } })
    expect(previewStyle().textContent).toContain("--font-display: 'Lora' !important")
    expect(previewStyle().textContent).toContain("--font-body: 'Inter' !important")
    expect(document.getElementById('google-font-Lora')).not.toBeNull()

    fireEvent.click(saveButton())
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
    expect(mockDispatch.mock.calls[0][0].graphql.variables.theme).toEqual({ fontHeading: 'Lora', fontBody: 'Inter' })
  })

  it('edits a role through the color input', () => {
    renderTab()
    fireEvent.change(screen.getByLabelText(/Background/), { target: { value: '#ff0000' } })
    expect(previewStyle().textContent).toContain('--background: 0 100% 50% !important')
  })

  it('blocks saving on contrast failures until the steward overrides', async () => {
    renderTab()
    fireEvent.change(screen.getByLabelText(/Background/), { target: { value: '#222222' } })

    expect(screen.getByTestId('group-theme-role-background')).toHaveTextContent('Low contrast')
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Save anyway, despite the contrast warnings'))
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
  })

  it('reports contrast failures in the scheme not being edited', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.change(screen.getByLabelText(/Card/), { target: { value: '#f5f5f5' } })
    expect(screen.getByTestId('group-theme-role-card')).toHaveTextContent('Low contrast')

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(screen.getByText(/Contrast warnings in Dark: \d/)).toBeInTheDocument()
  })

  it('reverts to the last saved theme without saving', () => {
    renderTab(savedTheme)
    expect(previewStyle()).toBeNull()

    fireEvent.click(screen.getByTestId('group-theme-preset-forest'))
    expect(previewStyle()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Revert to last saved' }))
    expect(previewStyle()).toBeNull()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('resets to default by clearing the theme', async () => {
    renderTab(savedTheme)
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled())
    expect(mockDispatch.mock.calls[0][0].graphql.variables).toEqual({ groupId: '42', theme: null })
  })

  it('does not reset when the steward cancels', () => {
    window.confirm = jest.fn(() => false)
    renderTab(savedTheme)
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('shows server errors', async () => {
    mockDispatch.mockRejectedValue(new Error('Invalid theme'))
    renderTab()
    fireEvent.click(screen.getByTestId('group-theme-preset-ocean'))
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid theme')
  })

  it('removes the page preview when it unmounts', () => {
    const { unmount } = renderTab()
    fireEvent.click(screen.getByTestId('group-theme-preset-forest'))
    expect(previewStyle()).not.toBeNull()
    unmount()
    expect(previewStyle()).toBeNull()
    expect(document.body.getAttribute('style') || '').not.toContain('--')
  })
})
