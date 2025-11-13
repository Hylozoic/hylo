import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DropdownButton from 'components/DropdownButton'

export default function PostCompletion ({ type, startTime, endTime, isFulfilled, fulfillPost, unfulfillPost }) {
  const { t } = useTranslation()

  const promptCompleteOptions = {
    request: t('Is this request still needed?'),
    offer: t('Is this offer still available?'),
    resource: t('Is this resource still available?'),
    project: t('Is this project still active?'),
    proposal: t('Is this proposal complete?')
  }

  const promptUnfulfillOptions = {
    request: t('Is this request needed again?'),
    offer: t('Is this offer available again?'),
    resource: t('Is this resource available again?'),
    project: t('Is this project active again?'),
    proposal: t('Is this proposal open again?')
  }

  const messages = {
    request: [
      { label: t('This is still needed'), value: false },
      { label: t('No longer needed'), value: true }
    ],
    offer: [
      { label: t('Available'), value: false },
      { label: t('Unavailable'), value: true }
    ],
    resource: [
      { label: t('Available'), value: false },
      { label: t('Unavailable'), value: true }
    ],
    project: [
      { label: t('Active'), value: false },
      { label: t('Completed'), value: true }
    ],
    proposal: [
      { label: t('No'), value: false },
      { label: t('Yes, I am ready to summarize'), value: true }
    ]
  }
  const label = messages[type].find(choice => choice.value === !!isFulfilled).label

  const prompt = useMemo(() => isFulfilled ? promptUnfulfillOptions[type] : promptCompleteOptions[type], [isFulfilled, type])
  const choices = messages[type]

  return (
    <div className='PostCompletion bg-secondary/30 border-secondary border-2 font-md flex justify-center items-center m-2 p-1 rounded-md'>
      <div className='mr-2'>{prompt}</div>
      <DropdownButton
        label={label}
        choices={choices}
        onChoose={response => {
          response === false ? unfulfillPost() : fulfillPost()
        }}
      />
    </div>
  )
}
