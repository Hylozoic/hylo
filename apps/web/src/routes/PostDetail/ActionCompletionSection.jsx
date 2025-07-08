import { Pencil, PartyPopper } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import { FileManager } from 'components/AttachmentManager/FileManager'
import CardFileAttachments from 'components/CardFileAttachments'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import * as Dialog from '@radix-ui/react-dialog'
import { Label } from 'components/ui/label'
import useRouteParams from 'hooks/useRouteParams'
import completePost from 'store/actions/completePost'
import getTrack from 'store/selectors/getTrack'

export default function ActionCompletionSection ({ post, currentUser }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const [completionResponse, setCompletionResponse] = useState(post.completionResponse || [])
  const [showTrackCompletionDialog, setShowTrackCompletionDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings
  const currentTrack = useSelector(state => getTrack(state, routeParams.trackId))

  const handleSubmitCompletion = useCallback(() => {
    if (completionAction === 'button' || completionResponse.length > 0) {
      // Check if the person has completed all actions in the track
      const allActionsCompleted = currentTrack?.posts.every(action => action.id === post.id || action.completedAt)
      if (allActionsCompleted && !post.completedAt) {
        setShowTrackCompletionDialog(true)
      }
      dispatch(completePost(post.id, completionResponse, currentTrack?.id, allActionsCompleted))
    }
    setIsEditing(false)
  }, [post, completionResponse, currentTrack?.id])

  useEffect(() => {
    // If the post is completed, or re-completed, close edit mode
    // This is needed when editing a comment or reaction type action completion
    setIsEditing(false)
    setCompletionResponse(post.completionResponse)
  }, [post.completedAt, post.completionResponse])

  const handleUploadAttachment = useCallback((attachments) => {
    setCompletionResponse(attachments.map(a => ({ id: a.id, url: a.url })))
  }, [])

  if (!completionAction) return null

  const completedAt = post.completedAt ? TextHelpers.formatDatePair(post.completedAt) : null
  let completionControls, completionButtonText, alreadyCompletedMessage
  let completionResponseText = completionResponse?.length > 0 ? completionResponse.map((r, i) => <p key={i}><HyloHTML html={r} /></p>) : null
  switch (completionAction) {
    case 'button':
      completionControls = null
      completionButtonText = 'Mark as Complete'
      break
    case 'selectOne':
      completionControls = (
        <RadioGroup onValueChange={(value) => setCompletionResponse([value])} value={completionResponse?.[0] || ''}>
          {options.map((option) => (
            <div key={option} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <RadioGroupItem value={option} id={`radio-${option}`} />
              <Label htmlFor={`radio-${option}`} className='cursor-pointer'>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      )
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('You selected:')
      break
    case 'selectMultiple':
      completionControls = (
        <ul className='list-none pl-1'>
          {options.map((option) => (
            <li key={option} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <Checkbox
                id={`checkbox-${option}`}
                key={option}
                checked={completionResponse?.includes(option) || false}
                onCheckedChange={(checked) => {
                  setCompletionResponse((prev) => {
                    if (checked) {
                      return [...(prev || []), option]
                    } else {
                      return (prev || []).filter(item => item !== option)
                    }
                  })
                }}
              />
              <Label htmlFor={`checkbox-${option}`} className='cursor-pointer'>{option}</Label>
            </li>
          ))}
        </ul>
      )
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('You selected:')
      break
    case 'text':
      completionControls = <textarea type='text' className='w-full outline-none border-border border-2 bg-input rounded-md p-2' value={completionResponse} onChange={(e) => setCompletionResponse([e.target.value])} />
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('Your response was:')
      break
    case 'uploadFile':
      completionControls = (
        <>
          <FileManager
            attachments={completionResponse}
            type='postCompletion'
            id={post.id}
            attachmentType='file'
            showLoading
            onChange={handleUploadAttachment}
          />
          <UploadAttachmentButton
            className='inline-block'
            type='postCompletion'
            attachmentType='all'
            allowMultiple
            onSuccess={(response) => setCompletionResponse(prev => prev.concat(response))}
          >
            <Button variant='outline'>
              {t('Upload Attachments')}
            </Button>
          </UploadAttachmentButton>
          <Button
            className='ml-2'
            disabled={completionResponse?.length === 0}
            onClick={handleSubmitCompletion}
          >
            {t('Submit Attachments and Complete')}
          </Button>
        </>
      )
      completionButtonText = null
      alreadyCompletedMessage = t('Your uploaded attachments:')
      completionResponseText = <CardFileAttachments attachments={completionResponse.map(a => ({ ...a, type: 'file' }))} />
      break
    case 'comment':
    case 'reaction':
      completionControls = null
      completionButtonText = null
      break
  }

  return (
    <div className='border-2 border-dashed border-foreground/20 rounded-md p-3 m-2'>
      {post.completedAt && !isEditing && (
        <div className='mb-1'>
          <p>{t('You completed this {{actionDescriptor}} {{date}}.', { date: completedAt, actionDescriptor: currentTrack?.actionDescriptor })} {alreadyCompletedMessage}</p>
          {completionResponse?.length > 0 && completionResponseText}
          <Button variant='outline' onClick={() => setIsEditing(true)}><Pencil className='w-4 h-4 cursor-pointer' /> Edit Response</Button>
        </div>
      )}
      {(!post.completedAt || isEditing) && (
        <>
          <h3>Complete this action</h3>
          <p className='font-bold'>{instructions}</p>
          {completionControls}
          {completionButtonText && <Button onClick={handleSubmitCompletion} disabled={completionResponse?.length === 0 && completionAction !== 'button'}>{completionButtonText}</Button>}
        </>
      )}
      <Dialog.Root open={showTrackCompletionDialog} onOpenChange={setShowTrackCompletionDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className='CompletedTrackDialog-Overlay bg-black/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[900] backdrop-blur-sm'>
            <Dialog.Content className='CompletedTrackDialog-Content min-w-[300px] w-full bg-background p-4 rounded-md z-[51] max-w-[750px] outline-none'>
              <PartyPopper className='w-10 h-10 text-green-500 mx-auto' />
              <Dialog.Title className='sr-only'>Congratulations!</Dialog.Title>
              <Dialog.Description className='sr-only'>Congratulations!</Dialog.Description>
              <h3 className='text-2xl font-bold text-center'>Congratulations, you have completed {currentTrack?.name}!</h3>
              {currentTrack?.completionMessage && (
                <ClickCatcher>
                  <HyloHTML element='p' html={TextHelpers.markdown(currentTrack?.completionMessage)} className='text-center text-foreground/70' />
                </ClickCatcher>
              )}
              {currentTrack?.completionRole && (
                <div className='text-center text-foreground border-2 border-selected/20 flex flex-col gap-2 items-center ml-auto mr-auto w-full mt-4 p-4 rounded-md border-dashed'>
                  <div>You've earned a new role!</div>
                  <div className='rounded-md bg-selected/50 shadow-xl border-2 border-selected/80 px-2 py-1 bg-selected'>{currentTrack?.completionRole.emoji} {currentTrack?.completionRole.name}</div>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
