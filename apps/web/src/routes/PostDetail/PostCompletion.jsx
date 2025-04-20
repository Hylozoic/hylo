import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { FileManager } from 'components/AttachmentManager/FileManager'
import CardFileAttachments from 'components/CardFileAttachments'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import completePost from 'store/actions/completePost'

export default function PostCompletion ({ post, currentUser }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [completionResponse, setCompletionResponse] = useState(post.completionResponse)
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings

  const handleSubmitCompletion = useCallback(() => {
    if (completionResponse.length > 0) {
      dispatch(completePost(post.id, completionResponse))
    }
  }, [post, completionResponse])

  const handleUploadAttachment = useCallback((attachments) => {
    setCompletionResponse(attachments.map(a => ({ id: a.id, url: a.url })))
  }, [])

  if (!completionAction) return null

  let completionControls, completionButtonText
  let alreadyCompletedMessage = t('You already completed this action. Your response was:')
  let completionResponseText = <p> {completionResponse.map(a => a.url).join(', ')}</p>
  switch (completionAction) {
    case 'button':
      completionControls = null
      completionButtonText = 'Mark as Complete'
      break
    case 'selectMultiple':
      completionControls = (
        <RadioGroup onValueChange={(value) => setCompletionResponse([value])}>
          {options.map((option) => (
            <div key={option} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <RadioGroupItem value={option} />
              <Label className='cursor-pointer'>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      )
      completionButtonText = 'Submit'
      break
    case 'selectOne':
      completionControls = (
        <div>
          {options.map((option) => (
            <Checkbox
              key={option}
              label={option}
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
          ))}
        </div>
      )
      completionButtonText = 'Submit'
      break
    case 'text':
      completionControls = <textarea type='text' className='w-full outline-none border-border border-2 bg-input rounded-md p-2' value={completionResponse} onChange={(e) => setCompletionResponse([e.target.value])} />
      completionButtonText = 'Submit'
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
            attachmentType='file'
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
      alreadyCompletedMessage = t('You already completed this action. Your uploaded attachments:')
      completionResponseText = <p><CardFileAttachments attachments={completionResponse.map(a => ({ ...a, type: 'file' }))} /></p>
      break
    default:
      completionControls = null
      completionButtonText = null
      break
  }

  return (
    <div className='border-2 border-dashed border-foreground/20 rounded-md p-3 m-2'>
      {post.completedAt && (
        <div className='mb-1'>
          <p>{alreadyCompletedMessage}</p>
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
