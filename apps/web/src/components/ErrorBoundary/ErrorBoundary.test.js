import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ErrorBoundary from './ErrorBoundary'

const Something = () => null

// Mock the rollbar module
jest.mock('client/rollbar', () => ({
  error: jest.fn()
}))

describe('ErrorBoundary', () => {
  it('renders children correctly', () => {
    render(
      <ErrorBoundary message='An Error Message'>
        <div data-testid='child'>Child Component</div>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders an error message when an error is thrown', () => {
    const ErrorThrowingComponent = () => {
      throw new Error('Test error')
    }

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary message='An Error Message'>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('An Error Message')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-container')).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })
})
