import React, { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'

/**
 * Displays event start/end times in the event timezone, with optional secondary display or tooltip for the viewer's timezone.
 */
export default function EventTimeDisplay ({
  startTime,
  endTime,
  timezone,
  showSecondary = false,
  showTooltip = false,
  showTimezoneLabel = true,
  tooltipId: tooltipIdProp,
  className,
  secondaryClassName,
  timezoneLabelClassName
}) {
  const { t } = useTranslation()
  const generatedTooltipId = useId()
  const tooltipId = tooltipIdProp || generatedTooltipId
  const locale = getLocaleFromLocalStorage()

  if (!startTime) return null

  const {
    primary,
    secondary,
    eventTimezoneLabel,
    userTimezoneLabel
  } = useMemo(
    () => DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone,
      locale
    }),
    [startTime, endTime, timezone, locale]
  )

  const primaryIncludesTimezone = eventTimezoneLabel && primary.includes(eventTimezoneLabel)
  const eventTimeLabel = showTimezoneLabel && !primaryIncludesTimezone && (
    <span className={cn('text-foreground/50 text-[10px] leading-tight', timezoneLabelClassName)}>
      {t('Event time ({{timezone}})', { timezone: eventTimezoneLabel })}
    </span>
  )

  const secondaryTimeLabel = secondary && t('Your time ({{timezone}}): {{time}}', {
    timezone: userTimezoneLabel,
    time: secondary
  })

  if (showSecondary && secondary) {
    return (
      <div className={cn('flex flex-col gap-0.5', className)}>
        <span>{primary}</span>
        {eventTimeLabel}
        <span className={cn('text-foreground/50 text-xs', secondaryClassName)}>
          {secondaryTimeLabel}
        </span>
      </div>
    )
  }

  if (showTooltip && secondary) {
    return (
      <>
        <div className={cn('flex flex-col gap-0.5', className)}>
          <span
            data-tooltip-id={tooltipId}
            data-tooltip-content={secondaryTimeLabel}
          >
            {primary}
          </span>
          {eventTimeLabel}
        </div>
        <Tooltip delay={550} id={tooltipId} position='top' />
      </>
    )
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span>{primary}</span>
      {eventTimeLabel}
    </div>
  )
}
