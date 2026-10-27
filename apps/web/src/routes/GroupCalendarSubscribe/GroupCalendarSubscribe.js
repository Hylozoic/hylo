import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Rss } from 'lucide-react'
import { cn } from 'util/index'
import { isCompactLayoutDevice } from 'util/mobile'
import CalendarSubscribeModal from './CalendarSubscribeModal'

/**
 * Subscribe-to-calendar pill for the view header, opening a modal with the calendar URL and
 * copy / Apple Calendar / Google Calendar actions.
 * Rendered when eventCalendarUrl is truthy, or when onEnsureCalendarUrl is provided (e.g. RSVP calendar: show button
 * even without URL; on click create token and get URL then open modal).
 * buttonLabel is the full description (accessible name, tooltip and default modal title); shortLabel is shown in the
 * pill on wider screens and "Subscribe" on phones, so the header keeps room for the view title.
 */
export default function GroupCalendarSubscribe ({ eventCalendarUrl, buttonLabel, shortLabel, modalTitle, onEnsureCalendarUrl }) {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)
  const [resolvedCalendarUrl, setResolvedCalendarUrl] = useState('')
  const label = buttonLabel || t('Subscribe to this Group\'s Calendar')
  const title = modalTitle != null ? modalTitle : label
  const compactLayout = isCompactLayoutDevice()

  const effectiveUrl = eventCalendarUrl || resolvedCalendarUrl

  const handleButtonClick = useCallback(async () => {
    if (effectiveUrl) {
      setModalVisible(true)
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
  }, [effectiveUrl, onEnsureCalendarUrl])

  const handleCloseModal = useCallback(() => setModalVisible(false), [])

  if (!eventCalendarUrl && !onEnsureCalendarUrl) return null

  return (
    <>
      {/* Tonal pill tinted with the theme's selected color so the subscribe option stands out (#1669) */}
      <button
        type='button'
        onClick={handleButtonClick}
        aria-label={label}
        title={label}
        data-testid='calendar-subscribe-button'
        className='flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-selected bg-selected/20 text-foreground hover:bg-selected/40 px-2.5 py-0.5 text-sm font-bold transition-all cursor-pointer'
      >
        <Rss className='w-4 h-4 shrink-0' />
        <span className={cn(!compactLayout && 'sm:hidden')}>{t('Subscribe')}</span>
        <span className={cn('hidden', !compactLayout && 'sm:inline')}>{shortLabel || t('Subscribe to calendar')}</span>
      </button>
      {modalVisible && (
        <CalendarSubscribeModal
          calendarUrl={effectiveUrl}
          title={title}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
