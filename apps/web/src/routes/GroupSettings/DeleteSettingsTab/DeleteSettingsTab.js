import PropTypes from 'prop-types'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import Button from 'components/ui/button'
import { useViewHeader } from 'contexts/ViewHeaderContext'

function DeleteSettingsTab ({ group, deleteGroup }) {
  const { name } = group
  const { t } = useTranslation()

  const handleDeleteGroup = useCallback(() => {
    if (window.confirm(t('Are you sure you want to delete the group {{name}}? This will permanently delete the group and all of its content. This cannot be undone.', { name }))) {
      deleteGroup()
    }
  }, [deleteGroup, name])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        desktop: `${t('Group Settings')} > ${t('Delete Group')}`,
        mobile: t('Delete Group')
      },
      icon: 'Settings'
    })
  }, [])

  return (
    <div>
      <h2 className='text-foreground font-bold mb-2'>{t('Delete {{groupName}}', { groupName: name })}</h2>
      <p className='text-foreground/70 mb-4'>
        {t('If you delete this group, it will no longer be visible to you or any of the members. All posts will also be deleted.')}
      </p>
      <Button
        variant='destructive'
        onClick={handleDeleteGroup}
        className='w-fit flex items-center justify-center gap-2 opacity-50 hover:opacity-100 hover:scale-105 transition-all duration-300'
      >
        <TriangleAlert className='w-4 h-4' />
        {t('Delete Group')}
        <TriangleAlert className='w-4 h-4' />
      </Button>
    </div>
  )
}

DeleteSettingsTab.propTypes = {
  group: PropTypes.object,
  deleteGroup: PropTypes.func
}

export default DeleteSettingsTab
