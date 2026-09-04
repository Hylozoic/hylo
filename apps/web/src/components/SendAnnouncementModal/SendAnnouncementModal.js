import React from 'react'
import { useTranslation } from 'react-i18next'
import classes from './SendAnnouncementModal.module.scss'
import Button from 'components/ui/button'

export default function SendAnnouncementModal ({
  closeModal,
  save,
  groupCount,
  myAdminGroups,
  groups
}) {
  const groupIds = groups.map(c => c.id)
  const groupAdminIds = myAdminGroups.map(c => c.id)
  const canAdminAllGroups = groupIds.every(val => groupAdminIds.indexOf(val) >= 0)
  const { t } = useTranslation()

  return (
    <div className={classes.modal}>
      <div className={classes.modalContainer}>
        <h1 className={classes.modalHeader}>{t('MAKE AN ANNOUNCEMENT')}</h1>
        {groupCount === 1 && canAdminAllGroups &&
          <p className={classes.modalParagraph}>{t('This marks the post as important and notifies everyone who hasn\'t turned off post notifications.')}</p>}
        {groupCount > 1 && canAdminAllGroups &&
          <p className={classes.modalParagraph}>{t('This marks the post as important and notifies everyone in the {{groupCount}} selected groups who hasn\'t turned off post notifications.', { groupCount })}</p>}

        {!canAdminAllGroups &&
          <span>
            <p className={classes.modalParagraph}>{t('This marks the post as important and notifies everyone in the {{groupCount}} selected groups who hasn\'t turned off post notifications.', { groupCount })}</p>
            <p className={classes.modalParagraph}>{t('This will only be sent as an Announcement to the groups where you are a Moderator. For other groups it will be shared as a regular Post.')}</p>
          </span>}
        <div>
          <Button variant='primary' onClick={closeModal}>{t('Go Back')}</Button>
          <Button variant='secondary' onClick={save}>{t('Send It')}</Button>
        </div>
      </div>
    </div>
  )
}
