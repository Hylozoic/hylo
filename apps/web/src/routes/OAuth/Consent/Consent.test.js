import Consent from './Consent'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import React from 'react'
import { useLocation } from 'react-router-dom'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn()
}))

it('renders correctly', () => {
  useLocation.mockReturnValue({ pathname: '/oauth/consent', search: '?name=CoolApp' })

  render(<Consent />)

  expect(screen.getByText('CoolApp wants access to your Hylo account')).toBeInTheDocument()
})
