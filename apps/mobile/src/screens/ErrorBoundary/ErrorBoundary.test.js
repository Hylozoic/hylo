import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import ErrorBoundary from './ErrorBoundary'
import * as Sentry from '@sentry/react-native'

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))

const ErrorComponent = () => {
  throw new Error()
}

describe('Error Boundary', () => {
  beforeEach(() => {
    Sentry.captureException.mockReset()
  })

  it('matches last snapshot', async () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Happy!</Text>
      </ErrorBoundary>
    )
    expect(await getByText('Happy!')).toBeDefined()
  })

  it('displays an error when a child component throws an error', async () => {
    const consoleSpy = jest.spyOn(console, 'error')
    consoleSpy.mockImplementation(() => {})
    const { getByText } = render(
      <ErrorBoundary t={str => str}>
        <ErrorComponent />
      </ErrorBoundary>
    )
    expect(await getByText('Oops Something Went Wrong')).toBeDefined()
    expect(Sentry.captureException).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
