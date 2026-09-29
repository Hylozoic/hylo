import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { AnalyticsEvents } from '@hylo/shared'
import { postUrl } from '@hylo/navigation'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { cn } from 'util/index'
import { isMobileDevice } from 'util/mobile'
import isWebView from 'util/webView'

/**
 * True where Share should open the device's share sheet: mobile web with the
 * Web Share API. Not in the mobile app's WebView, which has no share bridge
 * for it yet, and not on desktop, where copying the link is the norm.
 */
export function canUseShareSheet () {
  return !isWebView() &&
    isMobileDevice() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
}

/** The post's own address, which works for anyone who can see the post. */
export function postShareUrl (postId) {
  return `${window.location.origin}${postUrl(postId, { context: '' })}`
}

/**
 * A visible Share control for a post or event: the share sheet on mobile web,
 * otherwise the link is copied with a confirmation.
 */
export default function ShareButton ({ postId, postType, title, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const trackShare = useCallback(source => {
    dispatch(trackAnalyticsEvent(AnalyticsEvents.POST_SHARED, { postId, type: postType, source, surface: 'share_button' }))
  }, [dispatch, postId, postType])

  const copyLink = useCallback(async url => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('Link copied'))
      trackShare('copy_link')
    } catch (error) {
      toast.error(t('Couldn\'t copy the link'))
    }
  }, [t, trackShare])

  const handleClick = useCallback(async event => {
    // Cards open the post on click; sharing should not
    event.stopPropagation()
    event.preventDefault()
    const url = postShareUrl(postId)
    if (canUseShareSheet()) {
      try {
        await navigator.share({ title: title || undefined, url })
        trackShare('share_sheet')
      } catch (error) {
        // Closing the sheet is not a failure
        if (error?.name === 'AbortError') return
        await copyLink(url)
      }
      return
    }
    await copyLink(url)
  }, [copyLink, postId, title, trackShare])

  return (
    <button
      type='button'
      onClick={handleClick}
      className={cn('flex items-center gap-1 rounded-lg px-2 py-2 mb-1 text-xs text-foreground/60 hover:text-foreground hover:bg-darkening/10 transition-colors', className)}
      aria-label={t('Share')}
      data-testid='post-share-button'
    >
      <Share2 className='w-4 h-4' aria-hidden='true' />
      <span>{t('Share')}</span>
    </button>
  )
}
