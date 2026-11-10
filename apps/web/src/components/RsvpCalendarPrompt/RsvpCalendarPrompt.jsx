import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { CalendarPlus, Rss } from 'lucide-react'
import { postUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import CalendarSubscribeModal from 'routes/GroupCalendarSubscribe/CalendarSubscribeModal'
import updateUserSettings from 'store/actions/updateUserSettings'
import getMe from 'store/selectors/getMe'
import getPost from 'store/selectors/getPost'
import { canAddEventToCalendar, downloadEventIcs, googleCalendarEventUrl } from 'util/eventCalendar'
import isWebView from 'util/webView'
import {
  closeRsvpCalendarPrompt,
  getRsvpCalendarPromptOpen,
  getRsvpCalendarPromptPostId,
  shouldOfferRsvpCalendar
} from './RsvpCalendarPrompt.store'

/**
 * After a positive RSVP, offers to add that one event to the person's calendar (Google Calendar
 * link, or an .ics file for Apple Calendar / Outlook), and, as the secondary option, their RSVP
 * calendar feed (the same feed as the subscribe button on /all/events). Asks again on every
 * positive RSVP until they subscribe or choose "Don't ask again"; "Not now" or adding the one
 * event only closes it this time.
 */
export default function RsvpCalendarPrompt () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const requested = useSelector(getRsvpCalendarPromptOpen)
  const postId = useSelector(getRsvpCalendarPromptPostId)
  const event = useSelector(state => postId ? getPost(state, postId) : null)
  const [subscribing, setSubscribing] = useState(false)
  const [calendarUrl, setCalendarUrl] = useState('')

  const offer = shouldOfferRsvpCalendar(currentUser?.settings)
  const open = requested && offer

  // A request that won't be shown (already subscribed / opted out) must not linger and pop up later
  useEffect(() => {
    if (requested && !offer && !subscribing) dispatch(closeRsvpCalendarPrompt())
  }, [requested, offer, subscribing, dispatch])

  const close = useCallback(() => dispatch(closeRsvpCalendarPrompt()), [dispatch])

  const handleOpenChange = useCallback((isOpen) => {
    if (!isOpen) close()
  }, [close])

  const handleDontAskAgain = useCallback(() => {
    dispatch(updateUserSettings({ settings: { hideRsvpCalendarPrompt: true } }))
    close()
  }, [dispatch, close])

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true)
    try {
      // Same call as the /all/events subscribe button: turns the RSVP feed on and returns its URL
      const action = await dispatch(updateUserSettings({ settings: { rsvpCalendarSub: true } }))
      const url = get('payload.data.updateMe.rsvpCalendarUrl', action)
      if (url) setCalendarUrl(url)
    } catch (_) {
      // The prompt just closes; the feed can still be subscribed to from /all/events
    } finally {
      setSubscribing(false)
      close()
    }
  }, [dispatch, close])

  const canAddEvent = canAddEventToCalendar(event)
  // .ics is a blob download, which the mobile app's WebView can't handle; Google Calendar is an
  // https link, which the app opens in the system browser
  const canDownloadIcs = canAddEvent && !isWebView()
  const eventUrl = event ? `${window.location.origin}${postUrl(event.id, { context: '' })}` : ''

  const handleGoogleCalendar = useCallback(() => {
    window.open(googleCalendarEventUrl(event, eventUrl), '_blank', 'noopener,noreferrer')
    close()
  }, [event, eventUrl, close])

  const handleDownloadIcs = useCallback(() => {
    downloadEventIcs(event, eventUrl)
    close()
  }, [event, eventUrl, close])

  const handleCloseUrlModal = useCallback(() => setCalendarUrl(''), [])

  return (
    <>
      <Dialog open={open || subscribing} onOpenChange={handleOpenChange}>
        <DialogContent className='max-w-md' data-testid='rsvp-calendar-prompt'>
          {canAddEvent
            ? (
              <>
                <DialogHeader>
                  <DialogTitle className='flex items-center gap-2 leading-snug'>
                    <CalendarPlus className='w-5 h-5 shrink-0 text-selected' />
                    {t('Add this event to your calendar?')}
                  </DialogTitle>
                  <DialogDescription className='text-foreground/80 break-words' data-testid='rsvp-calendar-prompt-event-title'>
                    {event.title}
                  </DialogDescription>
                </DialogHeader>
                <div className='flex flex-col sm:flex-row gap-2'>
                  <Button variant='highVisibility' className='justify-center text-sm sm:text-sm' onClick={handleGoogleCalendar} disabled={subscribing} data-testid='rsvp-calendar-prompt-google'>
                    {t('Add to Google Calendar')}
                  </Button>
                  {canDownloadIcs && (
                    <Button variant='highVisibility' className='justify-center text-sm sm:text-sm' onClick={handleDownloadIcs} disabled={subscribing} data-testid='rsvp-calendar-prompt-ics'>
                      {t('Add to Apple or Outlook')}
                    </Button>
                  )}
                </div>
                <div className='border-t border-foreground/10 pt-4 flex flex-col gap-2'>
                  <p className='flex items-center gap-2 text-sm font-bold text-foreground'>
                    <Rss className='w-4 h-4 shrink-0 text-selected' />
                    {t('Or keep all your RSVPs in sync')}
                  </p>
                  <p className='text-sm text-foreground/80'>
                    {t('Subscribe once and every Hylo event you RSVP to will stay in sync with your calendar app.')}
                  </p>
                  <Button variant='outline' className='justify-center text-sm self-start' onClick={handleSubscribe} disabled={subscribing}>
                    {t('Subscribe')}
                  </Button>
                </div>
                <DialogFooter className='gap-2'>
                  <Button variant='ghost' className='justify-center' onClick={handleDontAskAgain} disabled={subscribing}>
                    {t('Don\'t ask again')}
                  </Button>
                  <Button variant='outline' className='justify-center text-sm' onClick={close} disabled={subscribing}>
                    {t('Not now')}
                  </Button>
                </DialogFooter>
              </>
              )
            : (
              <>
                <DialogHeader>
                  <DialogTitle className='flex items-center gap-2 leading-snug'>
                    <Rss className='w-5 h-5 shrink-0 text-selected' />
                    {t('Add your RSVPs to your calendar?')}
                  </DialogTitle>
                  <DialogDescription className='text-foreground/80'>
                    {t('Subscribe once and every Hylo event you RSVP to will stay in sync with your calendar app.')}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className='gap-2'>
                  <Button variant='ghost' className='justify-center' onClick={handleDontAskAgain} disabled={subscribing}>
                    {t('Don\'t ask again')}
                  </Button>
                  <Button variant='outline' className='justify-center text-sm' onClick={close} disabled={subscribing}>
                    {t('Not now')}
                  </Button>
                  <Button variant='highVisibility' className='justify-center text-sm sm:text-sm' onClick={handleSubscribe} disabled={subscribing}>
                    {t('Subscribe')}
                  </Button>
                </DialogFooter>
              </>
              )}
        </DialogContent>
      </Dialog>
      {calendarUrl && (
        <CalendarSubscribeModal
          calendarUrl={calendarUrl}
          title={t('Subscribe to all the Hylo events you have RSVPed to')}
          onClose={handleCloseUrlModal}
        />
      )}
    </>
  )
}
