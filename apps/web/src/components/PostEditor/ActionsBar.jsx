import isMobile from 'ismobilejs'
import { MapPin, SendHorizontal } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import SendAnnouncementModal from 'components/SendAnnouncementModal'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { cn } from 'util/index'

const actionIconClasses = 'text-[32px] cursor-pointer hover:text-[#0DC39F]'
const highlightIconClasses = 'text-[#0DC39F] cursor-default'

export default function ActionsBar ({
  id,
  addAttachment,
  announcementSelected,
  canMakeAnnouncement,
  isEditing,
  groupCount,
  groups,
  invalidMessage,
  loading,
  submitting = false,
  myAdminGroups,
  setAnnouncementSelected,
  setShowLocation,
  doSave, // Pops up announcement modal first if announcement is selected
  onAttachmentAdded,
  onInvalidSubmit,
  save, // Does actual save
  setIsDirty,
  showAnnouncementModal,
  showLocation,
  showFiles,
  showImages,
  submitButtonLabel,
  toggleAnnouncementModal,
  type,
  valid
}) {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const handleAttachmentUploaded = (attachment) => {
    dispatch(addAttachment('post', id, attachment))
    setIsDirty(true)
    onAttachmentAdded?.()
  }
  const handleUploadError = () => toast.error(t('Couldn\'t upload that file. Please try again.'))

  // Why Post can't be used yet is shown inline once someone tries, since the
  // hover tooltip never appears on touch screens
  const [showInvalidMessage, setShowInvalidMessage] = useState(false)
  useEffect(() => {
    if (valid) setShowInvalidMessage(false)
  }, [valid])

  const handleSubmitClick = () => {
    if (!valid) {
      setShowInvalidMessage(true)
      onInvalidSubmit?.()
      return
    }
    doSave()
  }

  return (
    <div className='w-full flex flex-wrap justify-between'>
      <div className='flex items-center gap-2'>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='image'
          onSuccess={handleAttachmentUploaded}
          onError={handleUploadError}
          allowMultiple
          disable={showImages}
        >
          <Icon
            name='AddImage'
            className={cn(actionIconClasses, { [highlightIconClasses]: showImages })}
            dataTestId='add-image-icon'
          />
        </UploadAttachmentButton>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='file'
          onSuccess={handleAttachmentUploaded}
          onError={handleUploadError}
          allowMultiple
          disable={showFiles}
        >
          <Icon
            name='Paperclip'
            className={cn(actionIconClasses, { [highlightIconClasses]: showFiles })}
            dataTestId='add-file-icon'
          />
        </UploadAttachmentButton>
        {type !== 'chat' && !showLocation && (
          <span data-tooltip-content={t('Add Location')} data-tooltip-id='location-tt' onClick={() => setShowLocation(true)}>
            <MapPin className={actionIconClasses} />
          </span>
        )}
        {canMakeAnnouncement && (
          <span data-tooltip-content={t('Send Announcement')} data-tooltip-id='announcement-tt'>
            <Icon
              dataTestId='announcement-icon'
              name='Announcement'
              onClick={() => {
                setAnnouncementSelected(!announcementSelected)
                setIsDirty(true)
              }}
              className={cn(actionIconClasses, {
                [highlightIconClasses]: announcementSelected
              })}
            />
            <Tooltip
              effect='solid'
              delayShow={10}
              id='announcement-tt'
            />
          </span>
        )}
        {showAnnouncementModal && (
          <SendAnnouncementModal
            closeModal={toggleAnnouncementModal}
            save={save}
            groupCount={groupCount}
            myAdminGroups={myAdminGroups}
            groups={groups}
          />
        )}
      </div>

      <div className='flex items-center gap-2'>
        {!isMobile.any && (
          <label className='text-xs italic text-foreground-muted'>
            {isEditing
              ? t(navigator.platform.includes('Mac') ? 'Option-Enter to save' : 'Alt-Enter to save')
              : t(navigator.platform.includes('Mac') ? 'Option-Enter to post' : 'Alt-Enter to post')}
          </label>
        )}
        <Button
          disabled={loading || submitting}
          ariaDisabled={!valid}
          onClick={handleSubmitClick}
          className='border-2 border-foreground/30 bg-foreground/30 px-2 py-1 rounded flex items-center'
          dataTipHtml={!valid ? invalidMessage : ''}
          dataFor='submit-tt'
          dataTestId='post-editor-submit'
          name={submitButtonLabel}
        >
          <SendHorizontal className={!valid || loading || submitting ? 'text-muted-foreground' : 'text-highlight'} size={18} style={{ display: 'inline' }} />
        </Button>

        <Tooltip
          delay={10}
          position='bottom'
          id='submit-tt'
        />
      </div>
      {showInvalidMessage && !valid && invalidMessage && (
        <div role='alert' className='basis-full text-right text-xs text-destructive pt-1' data-testid='post-editor-invalid-message'>
          {invalidMessage.split('<br />').map(message => <div key={message}>{message}</div>)}
        </div>
      )}
    </div>
  )
}
