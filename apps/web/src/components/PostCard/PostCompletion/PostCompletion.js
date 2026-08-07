import React from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from 'components/ui/switch'
import { cn } from 'util/index'

export default function PostCompletion ({ type, startTime, endTime, isFulfilled, fulfillPost, unfulfillPost, isModerator = false }) {
  const { t } = useTranslation()

  const promptCompleteOptions = {
    request: t('Is this request still needed?'),
    offer: t('Is this offer still available?'),
    resource: t('Is this resource still available?'),
    project: t('Is this project still active?'),
    proposal: t('Is this proposal still open?')
  }

  const prompt = promptCompleteOptions[type]

  const handleCheckedChange = (checked) => {
    checked ? unfulfillPost() : fulfillPost()
  }

  return (
    <div
      className={cn(
        'PostCompletion border-2 font-md flex flex-col justify-center items-center m-2 p-1 rounded-md',
        isModerator ? 'bg-accent/15 border-accent/60' : 'bg-secondary/30 border-secondary'
      )}
    >
      {isModerator && (
        <div className='text-xs font-semibold text-accent uppercase tracking-wide mb-1'>
          {t('Moderator')}
        </div>
      )}
      <div className='flex justify-center items-center'>
        <div className='mr-2'>{prompt}</div>
        <Switch
          yesNo
          checked={!isFulfilled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
    </div>
  )
}
