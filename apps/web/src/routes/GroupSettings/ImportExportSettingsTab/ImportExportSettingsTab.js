import PropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import classes from './ImportExportSettingsTab.module.scss'

function ImportExportSettingsTab ({ group }) {
  const { t } = useTranslation()

  const importStart = () => {
    window.alert(t('Import started!'))
  }

  const { name } = group

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: 'Group Settings > Import Posts by CSV',
      icon: 'Settings',
      info: ''
    })
  }, [])

  return (
    <div>
      <div className={classes.header}>
        <div className={classes.title}>{t('Import Posts by CSV')}</div>
      </div>
      <div className={classes.help}>
        <b>{t('WARNING: This is a beta feature that at this time will not inform you of import errors, use at your own risk.')}</b>
        <br /><br />
        {t('You can select a CSV file to import posts into {{name}}. Posts will be created by you. The file must have columns with the following headers:', { name })}
        <ul>
          <li>{t('title: text')}</li>
          <li>{t('description: text')}</li>
          <li>{t('location: text')}</li>
          <li>{t('type: one of discussion, request, offer, resource, event, project')}</li>
          <li>{t('start_date (optional): e.g. 20200730-12:23:12.000+00 (other date formats may work)')}</li>
          <li>{t('end_date (optional): e.g. 20200731-12:23:12.000+00 (other date formats may work)')}</li>
          <li>{t('image_urls: 1 or more image URLs separated by spaces and/or commas')}</li>
          <li>{t('topics: up to 3 topic names separated by spaces and/or commas e.g. “food organic”')}</li>
          <li>{t('is_public: true or false')}</li>
        </ul>
      </div>
      <div className={classes.buttonWrapper}>
        <UploadAttachmentButton
          type='importPosts'
          id={group.id}
          attachmentType='csv'
          onSuccess={importStart}
        >
          <div className={classes.uploadButton}>{t('Upload CSV')}</div>
        </UploadAttachmentButton>
      </div>
    </div>
  )
}

ImportExportSettingsTab.propTypes = {
  group: PropTypes.object
}

export default ImportExportSettingsTab
