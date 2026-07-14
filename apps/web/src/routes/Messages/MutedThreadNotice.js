import React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Warning shown when viewing a muted message thread.
 */
export default function MutedThreadNotice () {
  const { t } = useTranslation()

  return (
    <div className='mx-auto max-w-[750px] mb-2 rounded-lg border border-foreground/15 bg-darkening/20 px-3 py-2 text-sm text-foreground/80'>
      {t('This conversation is muted. Sending a message will not unmute it or turn notifications back on.')}
    </div>
  )
}
