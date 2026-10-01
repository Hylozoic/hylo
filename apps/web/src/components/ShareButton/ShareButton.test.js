/* eslint-env jest */
import React from 'react'
import { act, fireEvent } from '@testing-library/react'
import { toast } from 'sonner'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { isMobileDevice } from 'util/mobile'
import isWebView from 'util/webView'
import ShareButton from './ShareButton'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('util/mobile', () => ({ isMobileDevice: jest.fn(() => false) }))
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn((eventName, data) => ({ type: 'TEST_TRACK_ANALYTICS_EVENT', eventName, data })))

const writeText = jest.fn(() => Promise.resolve())

beforeEach(() => {
  writeText.mockClear()
  trackAnalyticsEvent.mockClear()
  toast.success.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  isMobileDevice.mockReturnValue(false)
  isWebView.mockReturnValue(false)
  delete navigator.share
})

function clickShare (onCardClick = jest.fn()) {
  render(
    <div onClick={onCardClick}>
      <ShareButton postId='42' postType='event' title='Seed swap' />
    </div>
  )
  return act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share' })) })
}

describe('ShareButton', () => {
  it('copies the post link on desktop, says so, and does not open the card', async () => {
    const onCardClick = jest.fn()
    navigator.share = jest.fn()
    await clickShare(onCardClick)

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/post/42`)
    expect(navigator.share).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Link copied')
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Post Shared', { postId: '42', type: 'event', source: 'copy_link', surface: 'share_button' })
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('opens the share sheet on mobile web', async () => {
    isMobileDevice.mockReturnValue(true)
    navigator.share = jest.fn(() => Promise.resolve())
    await clickShare()

    expect(navigator.share).toHaveBeenCalledWith({ title: 'Seed swap', url: `${window.location.origin}/post/42` })
    expect(writeText).not.toHaveBeenCalled()
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Post Shared', { postId: '42', type: 'event', source: 'share_sheet', surface: 'share_button' })
  })

  it('does nothing more when the share sheet is closed', async () => {
    isMobileDevice.mockReturnValue(true)
    navigator.share = jest.fn(() => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' })))
    await clickShare()

    expect(writeText).not.toHaveBeenCalled()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('copies the link in the mobile app instead of opening a share sheet', async () => {
    isMobileDevice.mockReturnValue(true)
    isWebView.mockReturnValue(true)
    navigator.share = jest.fn()
    await clickShare()

    expect(navigator.share).not.toHaveBeenCalled()
    await waitFor(() => expect(writeText).toHaveBeenCalled())
  })
})
