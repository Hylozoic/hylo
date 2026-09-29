import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { BUILDING_HYLO_ABOUT_PATH } from 'util/support'

/**
 * Small "Need help?" link to Building Hylo's public About page, for screens
 * where the support chat isn't available: sign in, sign up and error screens.
 * A plain link (full page load) so it still works when the app itself is
 * what broke.
 */
export default function NeedHelpLink ({ className }) {
  const { t } = useTranslation()
  return (
    <p className={cn('m-0 text-center text-sm', className)}>
      <a
        href={BUILDING_HYLO_ABOUT_PATH}
        className='text-foreground/70 underline underline-offset-2 hover:text-foreground'
        title={t('Ask the Hylo community in Building Hylo')}
        data-testid='need-help-link'
      >
        {t('Need help?')}
      </a>
    </p>
  )
}
