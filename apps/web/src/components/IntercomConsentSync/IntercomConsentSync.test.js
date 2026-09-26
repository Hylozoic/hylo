import { renderHook } from '@testing-library/react'
import { useIntercom } from 'react-use-intercom'
import IntercomConsentSync from './IntercomConsentSync'

jest.mock('react-use-intercom', () => {
  const intercom = { boot: jest.fn(), shutdown: jest.fn() }
  return { useIntercom: () => intercom }
})

const bootProps = { hideDefaultLauncher: true, userId: '1' }

function renderSync (allowed) {
  return renderHook(props => IntercomConsentSync(props), { initialProps: { allowed, bootProps } })
}

beforeEach(() => {
  useIntercom().boot.mockClear()
  useIntercom().shutdown.mockClear()
})

it('leaves the first render to the provider', () => {
  renderSync(true)
  renderSync(false)
  expect(useIntercom().boot).not.toHaveBeenCalled()
  expect(useIntercom().shutdown).not.toHaveBeenCalled()
})

it('shuts Intercom down when support cookies are rejected', () => {
  const { rerender } = renderSync(true)
  rerender({ allowed: false, bootProps })
  expect(useIntercom().shutdown).toHaveBeenCalledTimes(1)
  expect(useIntercom().boot).not.toHaveBeenCalled()
})

it('boots Intercom when support cookies are enabled later', () => {
  const { rerender } = renderSync(false)
  rerender({ allowed: true, bootProps })
  expect(useIntercom().boot).toHaveBeenCalledWith(bootProps)
})
