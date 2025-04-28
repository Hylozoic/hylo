import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { FileManager } from 'components/AttachmentManager/FileManager'
import CardFileAttachments from 'components/CardFileAttachments'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import useRouteParams from 'hooks/useRouteParams'
import completePost from 'store/actions/completePost'
import getTrack from 'store/selectors/getTrack'

export default function PostCompletion ({ post, currentUser }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const [completionResponse, setCompletionResponse] = useState(post.completionResponse || [])
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings
  const currentTrack = useSelector(state => getTrack(state, routeParams.trackId))

  const handleSubmitCompletion = useCallback(() => {
    if (completionAction === 'button' || completionResponse.length > 0) {
      dispatch(completePost(post.id, completionResponse))
    }
  }, [post, completionResponse])

  const handleUploadAttachment = useCallback((attachments) => {
    setCompletionResponse(attachments.map(a => ({ id: a.id, url: a.url })))
  }, [])

  if (!completionAction) return null

  const completedAt = post.completedAt ? TextHelpers.formatDatePair(post.completedAt) : null
  let completionControls, completionButtonText, alreadyCompletedMessage
  let completionResponseText = <p>{completionResponse.map(r => r).join(', ')}</p>
  switch (completionAction) {
    case 'button':
      completionControls = null
      completionButtonText = 'Mark as Complete'
      break
    case 'selectOne':
      completionControls = (
        <RadioGroup onValueChange={(value) => setCompletionResponse([value])} value={completionResponse[0]}>
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
                checked={completionResponse.includes(option)}
                onCheckedChange={(checked) => {
                  setCompletionResponse((prev) => {
                    if (checked) {
                      return [...prev, option]
                    } else {
                      return prev.filter(item => item !== option)
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
            disabled={completionResponse.length === 0}
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
      {post.completedAt && (
        <div className='mb-1'>
          <p>{t('You completed this {{actionTerm}} {{date}}.', { date: completedAt, actionTerm: currentTrack?.actionsName.slice(0, -1) })} {alreadyCompletedMessage}</p>
          {completionResponse?.length > 0 && completionResponseText}
        </div>
      )}
      {!post.completedAt && (
        <>
          <h3>Complete this action</h3>
          <p className='font-bold'>{instructions}</p>
          {completionControls}
          {completionButtonText && <Button onClick={handleSubmitCompletion}>{completionButtonText}</Button>}
        </>
      )}
    </div>
  )
}
