import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { act, createEvent, fireEvent, render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import Avatar from 'components/Avatar'
import fetchPerson from 'store/actions/fetchPerson'
import { OPEN_DELAY, LONG_PRESS_DELAY } from './ProfileHoverCard'

jest.mock('store/actions/fetchPerson', () => jest.fn(() => ({ type: 'FETCH_PERSON_TEST' })))

// react-router-dom's useLocation/useParams are mocked globally in the jest setup
function providers ({ loggedIn = true } = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  if (loggedIn) session.Me.create({ id: '1', name: 'Me' })
  session.Group.create({ id: '10', name: 'Garden', slug: 'garden' })
  session.Person.create({
    id: '2',
    name: 'Ada Lovelace',
    avatarUrl: 'ada.png',
    tagline: 'First programmer',
    canMessage: true,
    groupRoles: { items: [{ id: '7', name: 'Gardener', emoji: '🌱', active: true, groupId: '10' }] }
  })
  session.Person.create({ id: '1', name: 'Me' })
  session.Person.create({ id: '3', name: 'Grace Hopper', avatarUrl: 'grace.png', canMessage: false })
  return AllTheProviders({ orm: session.state })
}

// jsdom has no PointerEvent, so pointerType has to be set by hand. React
// derives onPointerEnter from pointerover.
function hover (el) {
  const event = createEvent.pointerOver(el)
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  fireEvent(el, event)
  act(() => { jest.advanceTimersByTime(OPEN_DELAY + 10) })
}

describe('Avatar profile hover card', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    fetchPerson.mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('does nothing without a personId', () => {
    const { container } = render(<Avatar avatarUrl='a.png' />, {}, providers())
    expect(container.querySelector('[data-profile-hover-card-trigger]')).not.toBeInTheDocument()
  })

  it('does nothing for logged-out viewers', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers({ loggedIn: false }))
    expect(container.querySelector('[data-profile-hover-card-trigger]')).not.toBeInTheDocument()
  })

  it('opens on hover, fetches lazily, and hides roles without group context', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    expect(fetchPerson).not.toHaveBeenCalled()
    hover(container.querySelector('[data-profile-hover-card-trigger]'))
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
    expect(fetchPerson).toHaveBeenCalledWith('2', expect.any(String))
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-card-roles')).not.toBeInTheDocument()
  })

  it('shows roles for the group in context', () => {
    // useRouteParams mutates the params object, and the global mock shares one across tests
    useParams.mockReturnValue({})
    useLocation.mockReturnValue({ pathname: '/groups/garden/stream', search: '' })
    try {
      const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
      hover(container.querySelector('[data-profile-hover-card-trigger]'))
      expect(screen.getByText('Gardener')).toBeInTheDocument()
    } finally {
      useLocation.mockReturnValue({ pathname: '', search: '' })
      useParams.mockReturnValue({})
    }
  })

  it('hides the Message button for someone the viewer cannot message', () => {
    const { container } = render(<Avatar avatarUrl='grace.png' personId='3' />, {}, providers())
    hover(container.querySelector('[data-profile-hover-card-trigger]'))
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.queryByText('Message')).not.toBeInTheDocument()
    expect(screen.getByText('View Profile')).toBeInTheDocument()
  })

  it('has no Message button on your own card', () => {
    const { container } = render(<Avatar avatarUrl='me.png' personId='1' />, {}, providers())
    hover(container.querySelector('[data-profile-hover-card-trigger]'))
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
    expect(screen.queryByText('Message')).not.toBeInTheDocument()
  })

  it('closes, and stays closed, when the viewer cannot see the profile (e.g. blocked)', async () => {
    fetchPerson.mockImplementationOnce(() => ({ type: 'FETCH_PERSON_TEST', payload: Promise.resolve({ data: { person: null } }) }))
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    const trigger = container.querySelector('[data-profile-hover-card-trigger]')
    hover(trigger)
    await act(async () => {})
    expect(screen.queryByTestId('profile-hover-card')).not.toBeInTheDocument()
    expect(container.querySelector('[data-profile-hover-card-trigger]')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    hover(container.querySelector('[data-profile-hover-card-trigger]'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('profile-hover-card')).not.toBeInTheDocument()
  })

  it('opens on long press but not on a tap', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    const trigger = container.querySelector('[data-profile-hover-card-trigger]')
    fireEvent.touchStart(trigger, { touches: [{ clientX: 5, clientY: 5 }] })
    fireEvent.touchEnd(trigger)
    act(() => { jest.advanceTimersByTime(LONG_PRESS_DELAY + 10) })
    expect(screen.queryByTestId('profile-hover-card')).not.toBeInTheDocument()

    fireEvent.touchStart(trigger, { touches: [{ clientX: 5, clientY: 5 }] })
    act(() => { jest.advanceTimersByTime(LONG_PRESS_DELAY + 10) })
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
  })

  it('does not open when the long press turns into a scroll', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    const trigger = container.querySelector('[data-profile-hover-card-trigger]')
    fireEvent.touchStart(trigger, { touches: [{ clientX: 5, clientY: 5 }] })
    fireEvent.touchMove(trigger, { touches: [{ clientX: 5, clientY: 60 }] })
    act(() => { jest.advanceTimersByTime(LONG_PRESS_DELAY + 10) })
    expect(screen.queryByTestId('profile-hover-card')).not.toBeInTheDocument()
  })
})
