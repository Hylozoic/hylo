import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { keyMap } from 'util/textInput'
import PeopleSelector from './PeopleSelector'
import { AllTheProviders } from 'util/testing/reactTestingLibraryExtended'

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
    render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
    expect(screen.getByPlaceholderText('+ Add someone')).toBeInTheDocument()
  })

  describe('onKeyDown', () => {
    it('does not hit server when backspace is pressed', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.keyDown(input, { keyCode: keyMap.BACKSPACE })
      await waitFor(() => expect(defaultProps.fetchPeople).not.toHaveBeenCalled())
    })

    it('hits server when the input value changes', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'not empty' } })
      await waitFor(() => expect(defaultProps.fetchPeople).toHaveBeenCalled())
    })

    it('removes participant if backspace pressed when autocompleteInput is empty', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.keyDown(input, { keyCode: keyMap.BACKSPACE })
      await waitFor(() => expect(defaultProps.removePerson).toHaveBeenCalled())
    })

    it('calls selectPerson with currentMatch when enter pressed', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.keyDown(input, { keyCode: keyMap.ENTER })
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })

    it('calls selectPerson with currentMatch when comma pressed', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.keyDown(input, { keyCode: keyMap.COMMA })
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })
  })

  describe('setPeopleSearch', () => {
    it('updates if user input contains valid characters', async () => {
      jest.useFakeTimers()
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'Poor Yorick' } })
      jest.runAllTimers()
      await waitFor(() => expect(defaultProps.setPeopleSearch).toHaveBeenCalledWith('Poor Yorick'))
      jest.useRealTimers()
    })

    it('does not update if user input contains invalid characters', async () => {
      jest.useFakeTimers()
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const input = screen.getByPlaceholderText('+ Add someone')
      fireEvent.change(input, { target: { value: 'Poor Yorick9238183$@#$$@!' } })
      jest.runAllTimers()
      await waitFor(() => expect(defaultProps.setPeopleSearch).not.toHaveBeenCalled())
      expect(input).toHaveValue('Poor Yorick')
      jest.useRealTimers()
    })
  })

  describe('selectPerson', () => {
    it('calls selectPerson with the correct id when clicking a person', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
      const personItem = screen.getByText('Person 1')
      fireEvent.click(personItem)
      await waitFor(() => expect(defaultProps.selectPerson).toHaveBeenCalledWith({ id: '1', name: 'Person 1' }))
    })

    it('resets values after adding a participant', async () => {
      render(<PeopleSelector {...defaultProps} />, { wrapper: AllTheProviders })
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
