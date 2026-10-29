import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { Rss } from 'lucide-react'
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
import {
  closeRsvpCalendarPrompt,
  getRsvpCalendarPromptOpen,
  shouldOfferRsvpCalendar
} from './RsvpCalendarPrompt.store'

/**
 * After a positive RSVP, offers the person's RSVP calendar feed (the same feed as the
 * subscribe button on /all/events). Asks again on every positive RSVP until they subscribe
 * or choose "Don't ask again"; "Not now" only closes it this time.
 */
export default function RsvpCalendarPrompt () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const requested = useSelector(getRsvpCalendarPromptOpen)
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

  const handleCloseUrlModal = useCallback(() => setCalendarUrl(''), [])

  return (
    <>
      <Dialog open={open || subscribing} onOpenChange={handleOpenChange}>
        <DialogContent className='max-w-md' data-testid='rsvp-calendar-prompt'>
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
