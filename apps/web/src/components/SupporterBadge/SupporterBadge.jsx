import { HeartHandshake } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

/**
 * Hylo supporter badge (#1754). Purely boolean: never shows amounts or tiers.
 * Render it only when the person or group has `isSupporter` (opted in and qualifying).
 * `group` switches the tooltip wording; `className` lets headers place it.
 */
export default function SupporterBadge ({ group = false, className }) {
  const { t } = useTranslation()
  const description = group
    ? t('This group supports Hylo, the nonprofit platform it runs on')
    : t('Supports Hylo, the nonprofit platform for communities')

  return (
    <span
      data-testid='supporter-badge'
      title={description}
      aria-label={`${t('Hylo Supporter')}: ${description}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-white/40 bg-black/40 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm',
        className
      )}
    >
      <HeartHandshake className='h-3.5 w-3.5 text-pink-300' aria-hidden='true' />
      {t('Hylo Supporter')}
    </span>
  )
}
