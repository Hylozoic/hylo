import React, { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import ModalDialog from 'components/ModalDialog'

const GOOGLE_CALENDAR_ADD_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'

/** Converts an https/http calendar URL to webcal so OS opens the default calendar app (e.g. Apple Calendar). */
const toWebcalUrl = (url) => url ? url.replace(/^https?:\/\//i, 'webcal://') : ''

const copyToClipboard = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
  } catch (_) {
    // clipboard may be unavailable (e.g. non-HTTPS)
  }
}

/**
 * Shows a calendar feed URL with copy / Apple Calendar / Google Calendar actions.
 * Portaled to the body so it isn't clipped or stacked under its opener (e.g. the sticky view header).
 */
export default function CalendarSubscribeModal ({ calendarUrl, title, onClose }) {
  const { t } = useTranslation()

  const handleCopy = useCallback(() => {
    copyToClipboard(calendarUrl)
  }, [calendarUrl])

  const handleGoogleCalendar = useCallback(() => {
    copyToClipboard(calendarUrl)
    window.open(GOOGLE_CALENDAR_ADD_URL, '_blank', 'noopener,noreferrer')
  }, [calendarUrl])

  const webcalUrl = useMemo(() => toWebcalUrl(calendarUrl), [calendarUrl])

  const handleAppleCalendar = useCallback(() => {
    if (webcalUrl) window.location.href = webcalUrl
  }, [webcalUrl])

  return createPortal(
    <ModalDialog
      closeModal={onClose}
      modalTitle={title}
      showCancelButton
      showSubmitButton={false}
    >
      <div className='flex flex-col gap-4'>
        <div>
          <p className='text-sm text-foreground/80 mb-2'>{t('Calendar subscription URL')}:</p>
          <button
            type='button'
            onClick={handleCopy}
            className='rounded-md text-sm font-mono text-secondary break-all text-left hover:underline cursor-pointer bg-midground/50 px-2 py-2 rounded border border-foreground/10'
            title={t('Click to copy')}
          >
            {calendarUrl}
          </button>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button color='green-white-green-border' className='rounded-md' narrow onClick={handleCopy}>
            {t('Copy')}
          </Button>
          <Button color='green-white-green-border' className='rounded-md' narrow onClick={handleAppleCalendar}>
            {t('Add to Apple or Outlook')}
          </Button>
          <Button color='green-white-green-border' className='rounded-md' narrow onClick={handleGoogleCalendar}>
            {t('Add to Google Calendar')}
          </Button>
        </div>
      </div>
    </ModalDialog>,
    document.body
  )
}
