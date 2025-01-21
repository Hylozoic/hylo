import PropTypes from 'prop-types'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import { useViewHeader } from 'contexts/ViewHeaderContext'

import classes from './DeleteSettingsTab.module.scss'

function DeleteSettingsTab ({ group, deleteGroup }) {
  const { name } = group
  const { t } = useTranslation()

  const handleDeleteGroup = useCallback(() => {
    if (window.confirm(t('Are you sure you want to delete the group {{name}}?', { name }))) {
      deleteGroup()
    }
  }, [deleteGroup, name])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Delete Group')}`,
      icon: 'Settings',
      info: ''
    })
  }, [])

  return (
    <div className={classes.container}>
      <div className={classes.title}>{t('Delete {{groupName}}', { groupName: name })}</div>
      <div className={classes.help}>
        {t('If you delete this group, it will no longer be visible to you or any of the members. All posts will also be deleted.')}
      </div>
      <Button
        label={t('Delete Group')}
        onClick={handleDeleteGroup}
        className={classes.deleteButton}
      />
    </div>
  )
}

DeleteSettingsTab.propTypes = {
  group: PropTypes.object,
  deleteGroup: PropTypes.func
}

export default DeleteSettingsTab
