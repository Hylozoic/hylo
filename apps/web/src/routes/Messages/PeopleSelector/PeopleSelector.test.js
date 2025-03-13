import React from 'react'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { keyMap } from 'util/textInput'
import PeopleSelector from './PeopleSelector'

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
  describe('onKeyDown', () => {
    it('does not hit server when backspace is pressed', async () => {
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.keyDown(input, { keyCode: keyMap.BACKSPACE })
      await waitFor(() => expect(defaultProps.fetchPeople).toHaveBeenCalledTimes(1))
    })

    it('hits server when the input value changes', async () => {
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'not empty' } })
      await waitFor(() => expect(defaultProps.fetchPeople).toHaveBeenCalled())
    })

    it('calls selectPerson with currentMatch when enter pressed', async () => {
      const { rerender } = render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      
      // First set the selectedIndex by triggering arrow down
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      
      // Then press enter
      fireEvent.keyDown(input, { key: 'Enter' })
      
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })
  })

  describe('selectPerson', () => {
    it('calls selectPerson with the correct id when clicking a person', async () => {
      render(<PeopleSelector {...defaultProps} />)
      const personItem = screen.getByText('Person 1')
      fireEvent.click(personItem)
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })

    it('resets values after adding a participant', async () => {
      render(<PeopleSelector {...defaultProps} />)
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'flargle' } })
      const personItem = screen.getByText('Person 1')
      fireEvent.click(personItem)
      await waitFor(() => {
        expect(input).toHaveValue('')
        expect(defaultProps.setPeopleSearch).toHaveBeenCalledWith(null)
      })
    })
  })
})
