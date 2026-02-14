import React from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from 'components/ui/switch'

export default function PostCompletion ({ type, startTime, endTime, isFulfilled, fulfillPost, unfulfillPost }) {
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
    <div className='PostCompletion bg-secondary/30 border-secondary border-2 font-md flex justify-center items-center m-2 p-1 rounded-md'>
      <div className='mr-2'>{prompt}</div>
      <Switch
        yesNo
        checked={!isFulfilled}
        onCheckedChange={handleCheckedChange}
      />
    </div>
  )
}
