import { MapPin } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Tooltip as ReactTooltip } from 'react-tooltip'
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
  groupCount,
  groups,
  invalidPostWarning,
  loading,
  myAdminGroups,
  setAnnouncementSelected,
  setShowLocation,
  save,
  showAnnouncementModal,
  showLocation,
  showFiles,
  showImages,
  submitButtonLabel,
  toggleAnnouncementModal,
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
          onSuccess={(attachment) => dispatch(addAttachment('post', id, attachment))}
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
          onSuccess={(attachment) => dispatch(addAttachment('post', id, attachment))}
          allowMultiple
          disable={showFiles}
        >
          <Icon
            name='Paperclip'
            className={cn(styles.actionIcon, { [styles.highlightIcon]: showFiles })}
            dataTestId='add-file-icon'
          />
        </UploadAttachmentButton>
        {!showLocation && (
          <span data-tooltip-content={t('Add Location')} data-tooltip-id='location-tt' onClick={() => setShowLocation(true)}>
            <MapPin className={styles.actionIcon} />
          </span>
        )}
        {canMakeAnnouncement && (
          <span data-tooltip-content={t('Send Announcement')} data-tooltip-id='announcement-tt'>
            <Icon
              dataTestId='announcement-icon'
              name='Announcement'
              onClick={() => setAnnouncementSelected(!announcementSelected)}
              className={cn(styles.actionIcon, {
                [styles.highlightIcon]: announcementSelected
              })}
            />
            <ReactTooltip
              effect='solid'
              delayShow={550}
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
      <Button
        onClick={save}
        disabled={!valid || loading}
        className={styles.postButton}
        label={submitButtonLabel}
        dataTip={!valid ? invalidPostWarning : ''}
        dataFor='submit-tt'
      />
      <Tooltip
        delay={150}
        position='bottom'
        id='submit-tt'
      />
    </div>
  )
}
