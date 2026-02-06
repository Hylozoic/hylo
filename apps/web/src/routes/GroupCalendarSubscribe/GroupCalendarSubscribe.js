import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Rss } from 'lucide-react'
import Button from 'components/Button'
import ModalDialog from 'components/ModalDialog'

const GOOGLE_CALENDAR_ADD_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'

/** Converts an https/http calendar URL to webcal so OS opens the default calendar app (e.g. Apple Calendar). */
const toWebcalUrl = (url) => url ? url.replace(/^https?:\/\//i, 'webcal://') : ''

const DEFAULT_BUTTON_LABEL = "Subscribe to this Group's Calendar"

/**
 * Renders a subscribe-to-calendar button and modal with calendar URL and copy / Apple Calendar / Google Calendar actions.
 * Rendered when eventCalendarUrl is truthy, or when onEnsureCalendarUrl is provided (e.g. RSVP calendar: show button
 * even without URL; on click create token and get URL then open modal).
 * Pass buttonLabel and modalTitle to customize copy (e.g. for RSVP calendar).
 */
export default function GroupCalendarSubscribe ({ eventCalendarUrl, buttonLabel = DEFAULT_BUTTON_LABEL, modalTitle, onEnsureCalendarUrl }) {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)
  const [resolvedCalendarUrl, setResolvedCalendarUrl] = useState('')
  const title = modalTitle != null ? modalTitle : buttonLabel

  const effectiveUrl = eventCalendarUrl || resolvedCalendarUrl

  const copyToClipboard = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch (_) {
      // clipboard may be unavailable (e.g. non-HTTPS)
    }
  }, [])

  const handleOpenModal = useCallback(() => setModalVisible(true), [])

  const handleButtonClick = useCallback(async () => {
    if (effectiveUrl) {
      handleOpenModal()
      return
    }
    if (onEnsureCalendarUrl) {
      try {
        const url = await onEnsureCalendarUrl()
        if (url) {
          setResolvedCalendarUrl(url)
          setModalVisible(true)
        }
      } catch (_) {
        // Do not open modal on error
      }
    }
  }, [effectiveUrl, onEnsureCalendarUrl, handleOpenModal])

  const handleCloseModal = useCallback(() => {
    setModalVisible(false)
  }, [])

  const handleCopy = useCallback(() => {
    copyToClipboard(effectiveUrl)
  }, [effectiveUrl, copyToClipboard])

  const handleUrlClick = useCallback(() => {
    copyToClipboard(effectiveUrl)
  }, [effectiveUrl, copyToClipboard])

  const handleGoogleCalendar = useCallback(() => {
    copyToClipboard(effectiveUrl)
    window.open(GOOGLE_CALENDAR_ADD_URL, '_blank', 'noopener,noreferrer')
  }, [effectiveUrl, copyToClipboard])

  const webcalUrl = useMemo(() => toWebcalUrl(effectiveUrl), [effectiveUrl])

  const handleAppleCalendar = useCallback(() => {
    if (webcalUrl) window.location.href = webcalUrl
  }, [webcalUrl])

  if (!eventCalendarUrl && !onEnsureCalendarUrl) return null

  return (
    <>
      <Button
        variant='outline'
        color='green-white-green-border'
        narrow
        onClick={handleButtonClick}
        className='rounded-md mt-4 flex items-center gap-2'
      >
        <Rss size={18} />
        {typeof buttonLabel === 'string' ? t(buttonLabel) : buttonLabel}
      </Button>
      {modalVisible && (
        <ModalDialog
          closeModal={handleCloseModal}
          modalTitle={typeof title === 'string' ? t(title) : title}
          showCancelButton
          showSubmitButton={false}
        >
          <div className='flex flex-col gap-4'>
            <div>
              <p className='text-sm text-foreground/80 mb-2'>{t('Calendar subscription URL')}:</p>
              <button
                type='button'
                onClick={handleUrlClick}
                className='rounded-md text-sm font-mono text-secondary break-all text-left hover:underline cursor-pointer bg-midground/50 px-2 py-2 rounded border border-foreground/10'
                title={t('Click to copy')}
              >
                {effectiveUrl}
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
        </ModalDialog>
      )}
    </>
  )
}
