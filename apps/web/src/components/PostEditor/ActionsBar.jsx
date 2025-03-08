import { MapPin, SendHorizontal } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import SendAnnouncementModal from 'components/SendAnnouncementModal'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { cn } from 'util/index'

import styles from './PostEditor.module.scss'

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
  myAdminGroups,
  setAnnouncementSelected,
  setShowLocation,
  doSave, // Pops up announcement modal first if announcement is selected
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

  return (
    <div className='w-full flex justify-between'>
      <div className='flex items-center gap-2'>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='image'
          onSuccess={(attachment) => {
            dispatch(addAttachment('post', id, attachment))
            setIsDirty(true)
          }}
          allowMultiple
          disable={showImages}
        >
          <Icon
            name='AddImage'
            className={cn(styles.actionIcon, { [styles.highlightIcon]: showImages })}
            dataTestId='add-image-icon'
          />
        </UploadAttachmentButton>
        <UploadAttachmentButton
          type='post'
          id={id}
          attachmentType='file'
          onSuccess={(attachment) => {
            dispatch(addAttachment('post', id, attachment))
            setIsDirty(true)
          }}
          allowMultiple
          disable={showFiles}
        >
          <Icon
            name='Paperclip'
            className={cn(styles.actionIcon, { [styles.highlightIcon]: showFiles })}
            dataTestId='add-file-icon'
          />
        </UploadAttachmentButton>
        {type !== 'chat' && !showLocation && (
          <span data-tooltip-content={t('Add Location')} data-tooltip-id='location-tt' onClick={() => setShowLocation(true)}>
            <MapPin className={styles.actionIcon} />
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
              className={cn(styles.actionIcon, {
                [styles.highlightIcon]: announcementSelected
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
        <label className='text-xs italic text-foreground/50'>
          {isEditing
            ? t(navigator.platform.includes('Mac') ? 'Option-Enter to save' : 'Alt-Enter to save')
            : t(navigator.platform.includes('Mac') ? 'Option-Enter to post' : 'Alt-Enter to post')}
        </label>
        <Button
          disabled={!valid || loading}
          onClick={doSave}
          className='border-2 border-foreground/30 bg-foreground/30 px-2 py-1 rounded flex items-center'
          dataTipHtml={!valid ? invalidMessage : ''}
          dataFor='submit-tt'
        >
          <SendHorizontal className={!valid || loading ? 'text-foreground/30' : 'text-highlight'} size={18} style={{ display: 'inline' }} />
        </Button>

        <Tooltip
          delay={10}
          position='bottom'
          id='submit-tt'
        />
      </div>
    </div>
  )
}
