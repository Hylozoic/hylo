import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import VerifyEmail from './VerifyEmail'

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: (domain) => {
    return {
      t: (str) => str,
      i18n: {
        changeLanguage: () => new Promise(() => {})
      }
    }
  }
}))
it('renders correctly', async () => {
  render(
    <VerifyEmail location={{ search: '?email=test@hylo.com' }} />
  )

  expect(screen.getByText("We've sent a 6 digit code", { exact: false })).toBeInTheDocument()
})
