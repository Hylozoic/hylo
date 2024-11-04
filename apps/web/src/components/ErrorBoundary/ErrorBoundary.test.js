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

it('renders children correctly', () => {
  const wrapper = mount(
    <ErrorBoundary message='An Error Message'>
      <Something />
    </ErrorBoundary>
  )
  expect(wrapper).toMatchSnapshot()
})

it('renders an error when an error is thrown', () => {
  const wrapper = mount(
    <ErrorBoundary message='An Error Message'>
      <Something />
    </ErrorBoundary>
  )
  wrapper.setState({ hasError: true })
  // * Alternative:
  // It's a bit more pentrating, but a little more noisy in output:
  // const error = new Error('** An expected error to demonstrtate ErrorBoundary **')
  // wrapper.find(Something).simulateError(error)

  expect(wrapper).toMatchSnapshot()
})
