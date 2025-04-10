import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import completePost from 'store/actions/completePost'

export default function PostCompletion ({ post, currentUser }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [completionResponse, setCompletionResponse] = useState([])
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings

  const handleSubmitCompletion = useCallback(() => {
    dispatch(completePost(post.id, completionResponse))
  }, [post, completionResponse])

  const handleUploadAttachment = useCallback((attachment) => {
    setCompletionResponse(attachment)
  }, [])

  if (!completionAction) return null

  let completionControls, completionButtonText
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
    case 'upload':
      completionControls = (
        <UploadAttachmentButton
          type='postCompletion'
          onSuccess={handleUploadAttachment}
        >
          <div className='flex flex-col items-center justify-center gap-1'>
            {completionResponse && completionResponse.name}
            <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Upload file')}</span>
          </div>
        </UploadAttachmentButton>
      )
      completionButtonText = 'Upload'
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
          <p>You already completed this action. Your response was:</p>
          {completionResponse?.length > 0 && <p className='font-bold'>{completionResponse.join(', ')}</p>}
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
