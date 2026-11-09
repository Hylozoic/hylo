import React from 'react'
import { fireEvent, render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import fetchPerson from 'store/actions/fetchPerson'
import ProfileCardDialog from './ProfileCardDialog'

jest.mock('store/actions/fetchPerson', () => jest.fn(() => ({ type: 'FETCH_PERSON_TEST' })))

function providers () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Me' })
  session.Person.create({ id: '1', name: 'Me', canMessage: false })
  session.Person.create({ id: '2', name: 'Ada Lovelace', canMessage: true })
  session.Person.create({ id: '3', name: 'Grace Hopper', canMessage: false })
  return AllTheProviders({ orm: session.state })
}

function openFor (personId) {
  render(<ProfileCardDialog personId={personId}><span>open</span></ProfileCardDialog>, {}, providers())
  fireEvent.click(screen.getByText('open'))
}

describe('ProfileCardDialog', () => {
  it('fetches the person when opened and offers Message when allowed', () => {
    openFor('2')
    expect(fetchPerson).toHaveBeenCalledWith('2', expect.any(String))
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Message' })).toBeInTheDocument()
  })

  it('hides Message for someone the viewer cannot message', () => {
    openFor('3')
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Message' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Profile' })).toBeInTheDocument()
  })

  it('hides Message on your own card', () => {
    openFor('1')
    expect(screen.queryByRole('button', { name: 'Message' })).not.toBeInTheDocument()
  })
})
