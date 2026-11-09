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

  function longPress (trigger) {
    fireEvent.touchStart(trigger, { touches: [{ clientX: 5, clientY: 5 }] })
    act(() => { jest.advanceTimersByTime(LONG_PRESS_DELAY + 10) })
    // false = the touchend was default-prevented, so no click follows it
    return fireEvent.touchEnd(trigger)
  }

  function touchPointerDown (el) {
    const event = createEvent.pointerDown(el)
    Object.defineProperty(event, 'pointerType', { value: 'touch' })
    fireEvent(el, event)
  }

  it('stays open after the long press is released, and the release does not click through', () => {
    const onParentClick = jest.fn()
    const { container } = render(<div onClick={onParentClick}><Avatar avatarUrl='ada.png' personId='2' url='/members/2' /></div>, {}, providers())
    const trigger = container.querySelector('[data-profile-hover-card-trigger]')
    expect(longPress(trigger)).toBe(false)
    // iOS can still deliver a click after a long press: it must be swallowed
    fireEvent.click(trigger)
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('stays open when focus moves elsewhere (e.g. to a focusable ancestor on release)', () => {
    const { container } = render(
      <span role='button' tabIndex={0} data-testid='focusable-parent'><Avatar avatarUrl='ada.png' personId='2' /></span>,
      {}, providers())
    longPress(container.querySelector('[data-profile-hover-card-trigger]'))
    act(() => { screen.getByTestId('focusable-parent').focus() })
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
  })

  it('a touch inside the card keeps it open', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    longPress(container.querySelector('[data-profile-hover-card-trigger]'))
    touchPointerDown(screen.getByText('View Profile'))
    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
  })

  it("a tap outside closes the card without activating what's under it", () => {
    const onOutsideClick = jest.fn()
    const { container } = render(
      <>
        <Avatar avatarUrl='ada.png' personId='2' />
        <button onClick={onOutsideClick}>Open post</button>
      </>,
      {}, providers())
    longPress(container.querySelector('[data-profile-hover-card-trigger]'))
    const outside = screen.getByText('Open post')
    touchPointerDown(outside)
    fireEvent.click(outside)
    expect(screen.queryByTestId('profile-hover-card')).not.toBeInTheDocument()
    expect(onOutsideClick).not.toHaveBeenCalled()
    // Only that one tap is swallowed
    fireEvent.click(outside)
    expect(onOutsideClick).toHaveBeenCalledTimes(1)
  })

  it('renders above app modals', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' />, {}, providers())
    hover(container.querySelector('[data-profile-hover-card-trigger]'))
    expect(screen.getByTestId('profile-hover-card').className).toContain('z-[1250]')
  })

  it('on touch-only devices renders a linked avatar as a link-like span (no OS link preview) with callout suppressed', () => {
    const original = window.matchMedia
    window.matchMedia = jest.fn(query => ({ matches: query === '(hover: none)', addListener () {}, removeListener () {} }))
    try {
      const { container } = render(<Avatar avatarUrl='ada.png' personId='2' url='/members/2' />, {}, providers())
      const trigger = container.querySelector('[data-profile-hover-card-trigger]')
      expect(trigger.tagName).toBe('SPAN')
      expect(trigger.getAttribute('role')).toBe('link')
      expect(container.querySelector('a')).not.toBeInTheDocument()
      expect(trigger.style.webkitTouchCallout || trigger.getAttribute('style')).toMatch(/none/)
    } finally {
      window.matchMedia = original
    }
  })

  it('keeps a real link on devices that can hover', () => {
    const { container } = render(<Avatar avatarUrl='ada.png' personId='2' url='/members/2' />, {}, providers())
    expect(container.querySelector('[data-profile-hover-card-trigger]').tagName).toBe('A')
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
