import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import NotFound from './index'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

it('offers Go back as a keyboard-operable button', () => {
  render(<NotFound />)

  fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

  expect(mockNavigate).toHaveBeenCalledWith('/')
})
