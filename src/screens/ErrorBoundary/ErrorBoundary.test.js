import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import ErrorBoundary from './ErrorBoundary'
import * as Sentry from '@sentry/react-native'

const renderProviders = (ui: React.ReactElement) => render(ui, {})

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))

const ErrorComponent = () => {
  throw new Error()
}

describe('Error Boundary', () => {
  beforeEach(() => {
    Sentry.captureException.mockReset()
  })

  it(`matches last snapshot`, () => {
    const { getByText } = renderProviders(
      <ErrorBoundary>
        <Text>Happy!</Text>
      </ErrorBoundary>
    )
    expect(getByText('Happy!')).toBeDefined()
  })

  it(`displays an error when a child component throws an error`, () => {
    const consoleSpy = jest.spyOn(console, 'error')
    consoleSpy.mockImplementation(() => {})
    const { getByText } = renderProviders(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )
    expect(getByText('Oops. Something Went Wrong')).toBeDefined()
    expect(Sentry.captureException).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
