import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'

import Avatar from 'components/Avatar'
import CardFileAttachments from 'components/CardFileAttachments'
import * as Dialog from '@radix-ui/react-dialog'
import HyloHTML from 'components/HyloHTML'
import { personUrl } from 'util/navigation'

export default function ActionCompletionResponsesDialog ({ portalTarget, post, onClose }) {
  const { t } = useTranslation()

  let title = t('Completions:') + ' '
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

  return (
    <Dialog.Root defaultOpen onOpenChange={onClose}>
      <Dialog.Portal container={document.getElementById(portalTarget)}>
        <Dialog.Overlay className='bg-darkening/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[900] backdrop-blur-sm'>
          <Dialog.Content className='min-w-[300px] w-full bg-background p-4 rounded-md z-[51] max-w-[750px] outline-none'>
            <Dialog.Title className='sr-only'>{title}</Dialog.Title>
            <Dialog.Description className='sr-only'>{title}</Dialog.Description>
            <h3 className='text-2xl font-bold text-center'>{title}</h3>
            {post.completionResponses.map(response => (
              <div key={response.id} className='flex flex-col gap-2 bg-midground rounded p-4 border-b-2 border-dashed border-foreground/20'>
                <div className='w-full flex flex-row justify-between'>
                  <span><Avatar url={personUrl(response.user.id)} avatarUrl={response.user.avatarUrl} small /> {response.user.name}</span>
                  <span>{TextHelpers.formatDatePair(response.completedAt)}</span>
                </div>
                <div className='text-sm'><CompletionResponse action={post.completionAction} response={response.completionResponse} /></div>
              </div>
            ))}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
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
