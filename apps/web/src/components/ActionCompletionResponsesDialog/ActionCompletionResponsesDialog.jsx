import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'

import Avatar from 'components/Avatar'
import CardFileAttachments from 'components/CardFileAttachments'
import ModalDialog from 'components/ModalDialog'
import HyloHTML from 'components/HyloHTML'
import { personUrl } from 'util/navigation'

export default function ActionCompletionResponsesDialog ({ portalTarget, post, onClose }) {
  const { t } = useTranslation()

  let title = t('Completions: ')
  switch (post.completionAction) {
    case 'button':
      title += t('By Button')
      break
    case 'comment':
      title += t('By Comment')
      break
    case 'reaction':
      title += t('By Reaction')
      break
    case 'selectMultiple':
      title += t('By Selected Options')
      break
    case 'selectOne':
      title += t('By Selected Option')
      break
    case 'text':
      title += t('By Text Reflection')
      break
    case 'uploadFile':
      title += t('By File Upload')
      break
  }

  console.log('post.completionResponsssses', post.completionResponses)
  return (
    <ModalDialog
      key='completion-responses-dialog'
      closeModal={onClose}
      modalTitle={title}
      portalTarget={portalTarget}
      showCancelButton={false}
      showSubmitButton={false}
      style={{ width: '100%', maxWidth: '620px' }}
    >
      {post.completionResponses.map(response => (
        <div key={response.id} className='flex flex-col gap-2 bg-midground rounded p-4 border-b-2 border-dashed border-foreground/20'>
          <div className='w-full flex flex-row justify-between'>
            <span><Avatar url={personUrl(response.user.id)} avatarUrl={response.user.avatarUrl} small /> {response.user.name}</span>
            <span>{TextHelpers.formatDatePair(response.completedAt)}</span>
          </div>
          <div className='text-sm'><CompletionResponse action={post.completionAction} response={response.completionResponse} /></div>
        </div>
      ))}
    </ModalDialog>
  )
}

function CompletionResponse ({ action, response }) {
  switch (action) {
    case 'selectMultiple':
      return response.join(', ')
    case 'selectOne':
      return response[0]
    case 'comment':
      return <HyloHTML html={response[0]} className='[&>p]:mt-0' />
    case 'reaction':
      return response[0]
    case 'text':
      return <HyloHTML html={response[0]} />
    case 'uploadFile':
      return <CardFileAttachments attachments={response.map(a => ({ ...a, type: 'file' }))} />
    default:
      return null
  }
}
