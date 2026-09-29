import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { POST_ACTIONS } from './postActionParams'

/**
 * Shown to the author when the open request nudge opens their request or offer (D58):
 * is it still needed, or has it been met? onAnswer receives a POST_ACTIONS value.
 */
export default function OpenRequestPrompt ({ postType, onAnswer }) {
  const { t } = useTranslation()
  const isOffer = postType === 'offer'

  return (
    <div
      className='border-2 border-dashed border-selected/40 rounded-lg p-3 mx-2 sm:mx-4 mb-3 flex flex-col sm:flex-row sm:items-center gap-3'
      data-testid='open-request-prompt'
    >
      <p className='m-0 flex-1 text-sm text-foreground/80'>
        {isOffer
          ? t('Nobody has replied to your offer yet. Is it still available?')
          : t('Nobody has replied to your request yet. Is it still needed?')}
      </p>
      <div className='flex flex-row gap-2'>
        <Button variant='outline' onClick={() => onAnswer(POST_ACTIONS.STILL_NEEDED)}>
          {isOffer ? t('Still available') : t('Still needed')}
        </Button>
        <Button onClick={() => onAnswer(POST_ACTIONS.MET)}>
          {isOffer ? t("It's been taken") : t("It's been met")}
        </Button>
      </div>
    </div>
  )
}
