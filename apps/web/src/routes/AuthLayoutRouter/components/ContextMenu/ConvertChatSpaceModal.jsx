import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { postUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import { FIELD_LABEL_CLASS, INPUT_CLASS } from 'components/ui/form-field'
import { Input } from 'components/ui/input'
import { convertChatSpaceToDiscussion } from 'store/actions/groupViews'

/**
 * Confirm step for turning a chat room into a discussion. The parent loads the preview.
 */
export function ConvertChatSpaceForm ({
  roomName,
  destinationName,
  preview,
  previewError,
  loading,
  title,
  onTitleChange,
  confirmName,
  onConfirmNameChange,
  submitting,
  onCancel,
  onConfirm
}) {
  const { t } = useTranslation()
  const nameMatches = confirmName.trim() === (roomName || '')
  const canConfirm = !loading && !previewError && !submitting && nameMatches && title.trim()

  return (
    <div
      data-testid='convert-chat-space-modal'
      className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md flex flex-col gap-2'
      onClick={event => event.stopPropagation()}
    >
      <h2 className='text-lg font-semibold'>{t('Convert chat room to discussion post')}</h2>
      <p className='m-0 text-sm leading-snug text-foreground/70'>
        {t('Each chat message becomes a comment on one discussion post, and this chat room is removed. No one is notified.')}
      </p>
      {destinationName && (
        <p className='m-0 text-sm leading-snug text-foreground/70'>
          {t('The discussion will be posted in {{name}}', { name: destinationName })}
        </p>
      )}

      {loading && <p className='m-0 text-sm text-foreground/60'>{t('Loading…')}</p>}
      {previewError && <p className='m-0 text-sm text-destructive'>{previewError}</p>}
      {preview && (
        <div className='flex flex-col gap-0.5 text-sm leading-snug text-foreground/80'>
          <p className='m-0'>
            {t('{{messageCount}} chat posts will be converted to comments on the discussion, with {{attachmentCount}} attachments and {{reactionCount}} reactions.', preview)}
          </p>
          {preview.replyCount > 0 && (
            <p className='m-0'>{t('{{replyCount}} comments on the chats will remain as replies to the comments.', preview)}</p>
          )}
        </div>
      )}

      <div className='flex flex-col gap-1'>
        <label className={FIELD_LABEL_CLASS} htmlFor='convert-chat-title'>{t('Discussion title')}</label>
        <Input
          id='convert-chat-title'
          className={INPUT_CLASS}
          value={title}
          onChange={event => onTitleChange(event.target.value)}
        />
      </div>

      <p className='m-0 text-xs text-foreground/60'>
        {t('This cannot be undone here, and no notifications are sent.')}
      </p>

      <div className='flex flex-col gap-1'>
        <label className={FIELD_LABEL_CLASS} htmlFor='convert-chat-confirm'>{t('Type {{name}} to confirm', { name: roomName })}</label>
        <Input
          id='convert-chat-confirm'
          className={INPUT_CLASS}
          value={confirmName}
          onChange={event => onConfirmNameChange(event.target.value)}
        />
      </div>

      <div className='flex justify-end gap-2'>
        <Button variant='primary' onClick={onCancel} disabled={submitting}>{t('Cancel')}</Button>
        <Button variant='secondary' onClick={onConfirm} disabled={!canConfirm}>
          {submitting ? t('Converting…') : t('Convert')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Admin-only dialog that previews a chat room and converts it into a discussion post.
 */
export default function ConvertChatSpaceModal ({ space, destination, onClose, onConverted }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const roomName = space?.name || ''
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState(roomName)
  const [confirmName, setConfirmName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    dispatch(convertChatSpaceToDiscussion({ spaceId: space.id, dryRun: true }))
      .then(result => {
        if (cancelled) return
        setPreview(result?.payload?.getData?.() || null)
      })
      .catch(error => {
        if (!cancelled) setPreviewError(error?.message || t('Could not preview this chat room'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [dispatch, space.id, t])

  /** Copy the room into a discussion, then link to it. */
  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const result = await dispatch(convertChatSpaceToDiscussion({
        spaceId: space.id,
        title: title.trim(),
        dryRun: false
      }))
      const data = result?.payload?.getData?.()
      const postId = data?.post?.id
      const url = postId && destination?.slug
        ? postUrl(postId, { groupSlug: destination.slug, context: 'groups' })
        : null
      toast.success(
        data?.queued
          ? t('This chat room is large, so the discussion is being created in the background.')
          : t('Chat room converted to a discussion'),
        url
          ? { action: { label: t('View discussion'), onClick: () => navigate(url) } }
          : undefined
      )
      onConverted?.(data)
      onClose()
    } catch (error) {
      toast.error(error?.message || t('Could not convert this chat room'))
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className='fixed inset-0 z-[1200] flex items-center justify-center bg-darkening/50 p-4'
      onClick={onClose}
    >
      <ConvertChatSpaceForm
        roomName={roomName}
        destinationName={destination?.name}
        preview={preview}
        previewError={previewError}
        loading={loading}
        title={title}
        onTitleChange={setTitle}
        confirmName={confirmName}
        onConfirmNameChange={setConfirmName}
        submitting={submitting}
        onCancel={onClose}
        onConfirm={handleConfirm}
      />
    </div>,
    document.body
  )
}
