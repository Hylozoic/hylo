import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { render, screen, fireEvent, within } from 'util/testing/reactTestingLibraryExtended'
import ReactionsDrawer from './ReactionsDrawer'

jest.mock('store/actions/fetchReactorAvatars', () => ({
  __esModule: true,
  default: (ids) => ({ type: 'FETCH_REACTOR_AVATARS_TEST', meta: { ids } })
}))

const currentUser = { id: '1', name: 'Me Myself', avatarUrl: 'https://example.com/me.png' }
const reactions = [
  { id: 'r1', emojiFull: '👍', user: { id: '2', name: 'Brendan Watson' } },
  { id: 'r2', emojiFull: '👍', user: { id: '1', name: 'Me Myself' } },
  { id: 'r3', emojiFull: '👍', user: { id: '3', name: 'Jessy Watson' } },
  { id: 'r4', emojiFull: '❤️', user: { id: '1', name: 'Me Myself' } },
  { id: 'r5', emojiFull: '❤️', user: { id: '3', name: 'Jessy Watson' } },
  { id: 'r6', emojiFull: '🎉', user: { id: '2', name: 'Brendan Watson' } }
]

function renderDrawer (props = {}) {
  const onRemoveReaction = jest.fn()
  const onOpenChange = jest.fn()
  render(
    <ReactionsDrawer
      open
      onOpenChange={onOpenChange}
      reactions={reactions}
      currentUser={currentUser}
      onRemoveReaction={onRemoveReaction}
      {...props}
    />
  )
  return { onRemoveReaction, onOpenChange }
}

// Row text without the decorative avatar initial
const rowTexts = () => screen.getAllByTestId('reactions-drawer-row').map(row => {
  const clone = row.cloneNode(true)
  clone.querySelectorAll('[aria-hidden]').forEach(el => el.remove())
  return clone.textContent
})

describe('ReactionsDrawer', () => {
  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/groups/test-group/post/10', search: '' })
    useParams.mockReturnValue({ groupSlug: 'test-group' })
  })

  afterEach(() => {
    useLocation.mockReturnValue({ pathname: '', search: '' })
    useParams.mockReturnValue({})
  })

  it('shows an All tab and one tab per emoji, most popular first, with counts', () => {
    renderDrawer()
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent.replace(/\s+/g, ''))
    expect(tabs).toEqual(['All6', '👍3', '❤️2', '🎉1'])
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByTestId('reactions-drawer-row')).toHaveLength(6)
  })

  it('lists only the people who reacted with the selected emoji, you first', () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('tab', { name: /👍/ }))
    expect(rowTexts()).toEqual([
      'YouTap to remove👍',
      'Brendan Watson👍',
      'Jessy Watson👍'
    ])

    fireEvent.click(screen.getByRole('tab', { name: /❤️/ }))
    expect(rowTexts()).toEqual(['YouTap to remove❤️', 'Jessy Watson❤️'])
  })

  it('opens on the emoji that was long-pressed', () => {
    renderDrawer({ initialEmoji: '🎉' })
    expect(screen.getByRole('tab', { name: /🎉/ })).toHaveAttribute('aria-selected', 'true')
    expect(rowTexts()).toEqual(['Brendan Watson🎉'])
  })

  it('removes your own reaction when your entry is tapped', () => {
    const { onRemoveReaction } = renderDrawer({ initialEmoji: '❤️' })
    const ownRow = screen.getByText('Tap to remove').closest('button')
    fireEvent.click(ownRow)
    expect(onRemoveReaction).toHaveBeenCalledWith('❤️')
  })

  it('links other people to their profile and closes', () => {
    const { onOpenChange, onRemoveReaction } = renderDrawer({ initialEmoji: '🎉' })
    const link = within(screen.getByTestId('reactions-drawer-list')).getByRole('link')
    expect(link).toHaveAttribute('href', '/groups/test-group/members/2')
    expect(link).not.toHaveTextContent('Tap to remove')
    fireEvent.click(link)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRemoveReaction).not.toHaveBeenCalled()
  })

  it('falls back to All when the selected emoji has no reactions left', () => {
    const props = { open: true, onOpenChange: jest.fn(), currentUser, onRemoveReaction: jest.fn(), initialEmoji: '🎉' }
    const { rerender } = render(<ReactionsDrawer {...props} reactions={reactions} />)
    rerender(<ReactionsDrawer {...props} reactions={reactions.filter(r => r.emojiFull !== '🎉')} />)
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByTestId('reactions-drawer-row')).toHaveLength(5)
  })

  it('closes when the last reaction is removed', () => {
    const onOpenChange = jest.fn()
    const props = { open: true, onOpenChange, currentUser, onRemoveReaction: jest.fn() }
    const { rerender } = render(<ReactionsDrawer {...props} reactions={[reactions[1]]} />)
    expect(onOpenChange).not.toHaveBeenCalled()
    rerender(<ReactionsDrawer {...props} reactions={[]} />)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes on Escape', () => {
    const { onOpenChange } = renderDrawer()
    fireEvent.keyDown(screen.getByTestId('reactions-drawer'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders nothing when closed', () => {
    renderDrawer({ open: false })
    expect(screen.queryByTestId('reactions-drawer')).not.toBeInTheDocument()
  })
})
