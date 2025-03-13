import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Header, { calculateMaxShown, generateDisplayNames, formatNames } from './Header'

describe('Header', () => {
  it('should render participant names', () => {
    const participants = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }, { id: 3, name: 'Three' }]
    const props = {
      currentUser: {
        id: 1,
        name: 'One'
      },
      messageThread: {
        participants
      }
    }
    render(<Header {...props} />)
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Three')).toBeInTheDocument()
  })
})

describe('calculateMaxShown', () => {
  it('returns array length if showAll', () => {
    const showAll = true
    const otherParticipants = [1, 2, 3]
    const expected = otherParticipants.length
    expect(calculateMaxShown(showAll, otherParticipants)).toEqual(expected)
  })

  it('returns 0 if array is not truthy', () => {
    const showAll = false
    const expected = 0
    expect(calculateMaxShown(showAll, undefined)).toEqual(expected)
  })

  it('returns the array length if the characters do not sum to the max allowed characters', () => {
    const showAll = false
    const otherParticipants = ['Jo', 'Alex', 'Carmen']
    const maxCharacters = 20
    const expected = otherParticipants.length
    expect(calculateMaxShown(showAll, otherParticipants, maxCharacters)).toEqual(expected)
  })

  it('returns the first n names that have fewer than maxCharacters', () => {
    const showAll = false
    const otherParticipants = ['Jo Lupo', 'Alex Trebeck', 'Carmen Sandiego']
    const maxCharacters = 20
    const expected = 2
    expect(calculateMaxShown(showAll, otherParticipants, maxCharacters)).toEqual(expected)
  })
})

describe('formatNames', () => {
  it('returns an object with a joined array of all participants if participants.length is equal to maxShown', () => {
    const maxShown = 3
    const otherParticipants = ['a', 'b', 'c']
    const result = formatNames(otherParticipants, maxShown)
    expect(result.displayNames).toEqual([['a', ''], ['b', ''], 'c'])
    expect(result.andOthers).toBeUndefined()
  })

  it('returns a truncated list of names and "n others" if maxShown is fewer than total participants', () => {
    const maxShown = 2
    const otherParticipants = ['a', 'b', 'c', 'd']
    const result = formatNames(otherParticipants, maxShown)
    expect(result.displayNames).toEqual([['a', ''], 'b'])
    expect(result.andOthers).toBe(' 2 others')
  })
})

describe('generateDisplayNames', () => {
  it('returns default if otherParticipants parameter is empty', () => {
    const currentUser = {
      id: 1,
      name: 'One'
    }
    const result = generateDisplayNames(null, [], currentUser)
    expect(result.displayNames.props.children).toBe('You')
  })

  it('returns formatted names for multiple participants', () => {
    const currentUser = { id: 1, name: 'One' }
    const participants = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' }
    ]
    const result = generateDisplayNames(3, participants, currentUser)
    expect(result.displayNames).toHaveLength(2)
    expect(result.displayNames[0][0].props.children).toBe('Two')
    expect(result.displayNames[1].props.children).toBe('Three')
  })
})
