import React from 'react'
import { act, createEvent, fireEvent, render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import fetchPerson from 'store/actions/fetchPerson'
import { OPEN_DELAY } from 'components/ProfileHoverCard'
import CurrentlyActivePills from './CurrentlyActivePills'

jest.mock('store/actions/fetchPerson', () => jest.fn(() => ({ type: 'FETCH_PERSON_TEST' })))

function providers () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Me' })
  session.Person.create({ id: '2', name: 'Ada Lovelace', avatarUrl: 'ada.png', canMessage: true })
  return AllTheProviders({ orm: session.state })
}

const ada = { id: '2', name: 'Ada Lovelace', avatarUrl: 'ada.png' }

// jsdom has no PointerEvent, so pointerType has to be set by hand. React
// derives onPointerEnter from pointerover.
function hover (el) {
  const event = createEvent.pointerOver(el)
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  fireEvent(el, event)
  act(() => { jest.advanceTimersByTime(OPEN_DELAY + 10) })
}

describe('CurrentlyActivePills', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    fetchPerson.mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('opens a profile hover card instead of a name tooltip', () => {
    const { container } = render(
      <CurrentlyActivePills members={[ada]} profileHoverCard onPersonClick={jest.fn()} />,
      {},
      providers()
    )
    const face = container.querySelector('[data-profile-hover-card-trigger]')
    expect(face).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    hover(face)

    expect(screen.getByTestId('profile-hover-card')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(fetchPerson).toHaveBeenCalledWith('2', expect.any(String))
  })

  it('keeps the name tooltip when the profile card is off', () => {
    const { container } = render(
      <CurrentlyActivePills members={[ada]} onPersonClick={jest.fn()} />,
      {},
      providers()
    )
    expect(container.querySelector('[data-profile-hover-card-trigger]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeInTheDocument()
  })

  it('still selects the member on click when the profile card is on', () => {
    const onPersonClick = jest.fn()
    render(
      <CurrentlyActivePills members={[ada]} profileHoverCard onPersonClick={onPersonClick} />,
      {},
      providers()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace' }))
    expect(onPersonClick).toHaveBeenCalledWith(ada)
  })
})
