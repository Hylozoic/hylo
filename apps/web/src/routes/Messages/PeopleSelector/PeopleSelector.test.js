import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import PeopleSelector from './PeopleSelector'

beforeAll(() => {
  Element.prototype.scrollTo = jest.fn()
})

const defaultProps = {
  setPeopleSearch: jest.fn(),
  fetchPeople: jest.fn(),
  fetchContacts: jest.fn(),
  fetchDefaultList: jest.fn(),
  selectPerson: jest.fn(),
  removePerson: jest.fn(),
  changeQuerystringParam: jest.fn(),
  selectedPeople: [],
  onCloseLocation: '',
  peopleSelectorOpen: true,
  people: [{ id: '1', name: 'Person 1' }, { id: '2', name: 'Person 2' }]
}

describe('PeopleSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the component', () => {
    render(<PeopleSelector {...defaultProps} />)
    expect(screen.getByPlaceholderText('+ Add someone')).toBeInTheDocument()
  })

  describe('setPeopleSearch', () => {
    it('does not update if user input contains invalid characters', async () => {
      jest.useFakeTimers()
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'Poor Yorick9238183$@#$$@!' } })
      jest.runAllTimers()
      await waitFor(() => expect(defaultProps.setPeopleSearch).not.toHaveBeenCalled())
      expect(input).toHaveValue('Poor Yorick')
      jest.useRealTimers()
    })

    it('updates if user input contains valid characters', async () => {
      jest.useFakeTimers()
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'Poor Yorick' } })
      jest.runAllTimers()
      await waitFor(() => expect(defaultProps.setPeopleSearch).toHaveBeenCalledWith('Poor Yorick'))
      jest.useRealTimers()
    })
  })

  describe('selectPerson', () => {
    it('calls selectPerson with the correct id when clicking a person', async () => {
      render(<PeopleSelector {...defaultProps} />)
      fireEvent.click(screen.getByText('Person 1'))
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })

    it('resets values after adding a participant', async () => {
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'flargle' } })
      fireEvent.click(screen.getByText('Person 1'))
      await waitFor(() => {
        expect(input).toHaveValue('')
        expect(defaultProps.setPeopleSearch).toHaveBeenCalledWith(null)
      })
    })
  })
})
