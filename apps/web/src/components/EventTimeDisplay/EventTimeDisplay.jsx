import React, { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'

/**
 * Post details lead with the viewer's time, then the event's local time when the zones differ.
 * The "Your time" label is omitted when both zones match. Cards show the viewer's time only.
 */
export default function EventTimeDisplay ({
  startTime,
  endTime,
  timezone,
  showSecondary = false,
  showTooltip = false,
  tooltipId: tooltipIdProp,
  className,
  secondaryClassName
}) {
  const { t } = useTranslation()
  const generatedTooltipId = useId()
  const tooltipId = tooltipIdProp || generatedTooltipId
  const locale = getLocaleFromLocalStorage()

  const { primary, secondary } = useMemo(
    () => DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone,
      locale
    }),
    [startTime, endTime, timezone, locale]
  )

  if (!startTime) return null

  const viewerTime = secondary || primary
  const yourTimeLabel = t('Your time: {{time}}', { time: viewerTime })
  const localTimeLabel = secondary
    ? t('Local time: {{time}}', { time: primary })
    : null

  if (showSecondary) {
    return (
      <div className={cn('flex flex-col gap-0.5', className)}>
        <span>{localTimeLabel ? yourTimeLabel : viewerTime}</span>
        {localTimeLabel && (
          <span className={cn('text-foreground/50 text-xs', secondaryClassName)}>
            {localTimeLabel}
          </span>
        )}
      </div>
    )
  }

  if (showTooltip && localTimeLabel) {
    return (
      <>
        <div className={cn('flex flex-col gap-0.5', className)}>
          <span
            data-tooltip-id={tooltipId}
            data-tooltip-content={localTimeLabel}
          >
            {viewerTime}
          </span>
        </div>
        <Tooltip delay={550} id={tooltipId} position='top' />
      </>
    )
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span>{viewerTime}</span>
    </div>
  )
}
