import React from 'react'
import { render, screen, fireEvent, act } from 'util/testing/reactTestingLibraryExtended'
import EmojiRow from './EmojiRow'

const mockReactOnEntity = jest.fn()
const mockRemoveReactOnEntity = jest.fn()

jest.mock('hooks/useReactionActions', () => ({
  __esModule: true,
  default: () => ({ reactOnEntity: mockReactOnEntity, removeReactOnEntity: mockRemoveReactOnEntity })
}))

jest.mock('store/actions/fetchReactorAvatars', () => ({
  __esModule: true,
  default: () => ({ type: 'FETCH_REACTOR_AVATARS_TEST' })
}))

const currentUser = { id: '1', name: 'Me Myself' }
const post = {
  id: '10',
  groups: [{ id: '5' }],
  postReactions: [
    { id: 'r1', emojiFull: '👍', user: { id: '1', name: 'Me Myself' } },
    { id: 'r2', emojiFull: '👍', user: { id: '2', name: 'Brendan Watson' } },
    { id: 'r3', emojiFull: '🎉', user: { id: '2', name: 'Brendan Watson' } }
  ]
}

const pillLabel = emoji => screen.getByText(emoji).closest('span.text-inherit')
const touch = { touches: [{ pageX: 5, pageY: 5, clientX: 5, clientY: 5 }] }

describe('EmojiRow', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockReactOnEntity.mockClear()
    mockRemoveReactOnEntity.mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('opens the reactions drawer on the long-pressed emoji', () => {
    render(<EmojiRow post={post} currentUser={currentUser} />)
    const pill = pillLabel('🎉')
    fireEvent.touchStart(pill, touch)
    act(() => { jest.advanceTimersByTime(500) })
    fireEvent.touchEnd(pill)

    expect(screen.getByTestId('reactions-drawer')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /🎉/ })).toHaveAttribute('aria-selected', 'true')
    expect(mockReactOnEntity).not.toHaveBeenCalled()
    expect(mockRemoveReactOnEntity).not.toHaveBeenCalled()
  })

  it('removing your own entry in the drawer uses the remove reaction action', () => {
    render(<EmojiRow post={post} currentUser={currentUser} />)
    const pill = pillLabel('👍')
    fireEvent.touchStart(pill, touch)
    act(() => { jest.advanceTimersByTime(500) })
    fireEvent.touchEnd(pill)

    fireEvent.click(screen.getByText('Tap to remove'))
    expect(mockRemoveReactOnEntity).toHaveBeenCalledWith(expect.objectContaining({ emojiFull: '👍', entityType: 'post', postId: '10' }))
  })

  it('still toggles a reaction on a tap', () => {
    render(<EmojiRow post={post} currentUser={currentUser} />)
    fireEvent.touchStart(pillLabel('🎉'), touch)
    fireEvent.touchEnd(pillLabel('🎉'))
    fireEvent.click(pillLabel('🎉'))
    expect(mockReactOnEntity).toHaveBeenCalledWith(expect.objectContaining({ emojiFull: '🎉' }))
    expect(screen.queryByTestId('reactions-drawer')).not.toBeInTheDocument()
  })

  it('does not open the drawer for anonymous viewers', () => {
    render(<EmojiRow post={post} />)
    fireEvent.touchStart(pillLabel('🎉'), touch)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.queryByTestId('reactions-drawer')).not.toBeInTheDocument()
  })
})
