import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { isSandboxMode } from 'sandbox/isSandbox'
import useEmailClickthrough, { RECORD_EMAIL_CLICK, hasEmailClickParams, stripEmailClickParams } from './useEmailClickthrough'

const mockDispatch = jest.fn(action => Promise.resolve(action))

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

// The shared test setup stubs useLocation; these tests need the real router
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'))

jest.mock('sandbox/isSandbox', () => ({
  isSandboxMode: jest.fn(() => false)
}))

let navigateTo

function Harness () {
  useEmailClickthrough()
  const location = useLocation()
  navigateTo = useNavigate()
  return <div data-testid='location'>{location.pathname + location.search + location.hash}</div>
}

function renderAt (url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Harness />
    </MemoryRouter>
  )
}

const currentUrl = () => screen.getByTestId('location').textContent
const recordedClicks = () => mockDispatch.mock.calls.filter(([action]) => action?.type === RECORD_EMAIL_CLICK)

beforeEach(() => {
  mockDispatch.mockClear()
  isSandboxMode.mockReturnValue(false)
})

describe('stripEmailClickParams', () => {
  it('removes exactly ctt, cti and ctcn and keeps everything else in order', () => {
    expect(stripEmailClickParams('?ctt=digest_email&token=abc&cti=12&action=unfollow&ctcn=My+Group&u=5'))
      .toBe('?token=abc&action=unfollow&u=5')
    expect(stripEmailClickParams('?ctt=digest_email&cti=12&ctcn=Group')).toBe('')
    expect(stripEmailClickParams('')).toBe('')
  })

  it('only reports the email tags', () => {
    expect(hasEmailClickParams('?ctcn=x')).toBe(true)
    expect(hasEmailClickParams('?action=unfollow&token=abc')).toBe(false)
  })
})

describe('useEmailClickthrough', () => {
  it('records one click with the kind of email and removes only the tags', async () => {
    renderAt('/groups/garden/post/7?ctt=post_email&cti=42&ctcn=Garden&action=unfollow&token=t1#comment_3')
    await act(async () => {})

    expect(currentUrl()).toBe('/groups/garden/post/7?action=unfollow&token=t1#comment_3')
    const clicks = recordedClicks()
    expect(clicks).toHaveLength(1)
    expect(clicks[0][0].graphql.variables).toEqual({ emailType: 'post_email' })
    expect(JSON.stringify(clicks[0][0])).not.toContain('42')
    expect(JSON.stringify(clicks[0][0])).not.toContain('Garden')
  })

  it('keeps the settings-link login and unsubscribe parameters', async () => {
    renderAt('/my/notifications?ctt=digest_email&cti=42&ctcn=Hylo&token=jwt123&name=unsubscribe&expand=account')
    await act(async () => {})
    expect(currentUrl()).toBe('/my/notifications?token=jwt123&name=unsubscribe&expand=account')
  })

  it('does not record again when the tags come back later in the visit', async () => {
    renderAt('/groups/garden?ctt=digest_email&cti=42')
    await act(async () => {})
    expect(recordedClicks()).toHaveLength(1)

    await act(async () => {
      navigateTo('/groups/garden/post/7?ctt=digest_email&cti=42&ctcn=Garden')
    })
    expect(currentUrl()).toBe('/groups/garden/post/7')
    expect(recordedClicks()).toHaveLength(1)
  })

  it('strips the other tags without recording when there is no email type', async () => {
    renderAt('/groups/garden?cti=42&ctcn=Garden')
    await act(async () => {})
    expect(currentUrl()).toBe('/groups/garden')
    expect(recordedClicks()).toHaveLength(0)
  })

  it('leaves an address without the tags alone', async () => {
    renderAt('/groups/garden?token=abc')
    await act(async () => {})
    expect(currentUrl()).toBe('/groups/garden?token=abc')
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('does not record in the sandbox demo but still strips the tags', async () => {
    isSandboxMode.mockReturnValue(true)
    renderAt('/groups/garden?ctt=digest_email')
    await act(async () => {})
    expect(currentUrl()).toBe('/groups/garden')
    expect(recordedClicks()).toHaveLength(0)
  })
})
